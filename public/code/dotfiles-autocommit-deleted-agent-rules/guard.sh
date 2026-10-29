#!/bin/bash
# chezmoi-sync-guard.sh — refuse to auto-commit a working tree that looks like a
# stale overwrite, a mass change, a truncation, a leaked secret or restore noise.
#
# Usage: chezmoi-sync-guard.sh [repo-dir]   (run after `git add -A`, before commit)
# Exit 0 = safe to commit. Exit 1 = blocked; reasons on stderr.
# Intentional big changes: CHEZMOI_SYNC_ALLOW_MASS=1 (run by hand, never in the timer unit).
#
# Why: on 23 Sep 2026 a 15-minute auto-commit recorded a stale copy of agents/
# (three rules deleted, twelve reverted) and pushed it within seconds.
set -euo pipefail
cd "${1:-.}"

MAX_FILES="${CHEZMOI_SYNC_MAX_FILES:-15}"
PROTECTED="${CHEZMOI_SYNC_PROTECTED:-agents/rules agents/skills agents/sync-agent-rules.sh bin}"
SHRINK_MIN_LINES="${CHEZMOI_SYNC_SHRINK_MIN_LINES:-20}"

[ "${CHEZMOI_SYNC_ALLOW_MASS:-0}" = "1" ] && exit 0

status="$(git diff --cached --name-status)"
[ -z "$status" ] && exit 0

mtime_of() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1"; }
protected() { local p; for p in $PROTECTED; do case "$1" in "$p"|"$p"/*) return 0;; esac; done; return 1; }

reasons=()
count=0
while IFS=$'\t' read -r st path newpath; do
  [ -n "$st" ] || continue
  count=$((count+1))
  case "$st" in
    D*) protected "$path" && reasons+=("deletes protected file: $path") ;;
    R*) protected "$path" && reasons+=("renames protected file: $path -> $newpath") ;;
    M)
      # A modified file whose mtime predates the commit that last touched it was
      # copied in from an older snapshot (rsync -a, rclone, restore), not edited.
      if [ -f "$path" ]; then
        last="$(git log -1 --format=%ct -- "$path" 2>/dev/null || echo 0)"
        [ "$(mtime_of "$path")" -lt "$last" ] && reasons+=("$path: mtime older than its last commit (stale copy?)")
        old_lines="$(git show "HEAD:$path" 2>/dev/null | wc -l)"
        new_lines="$(wc -l <"$path")"
        if [ "$old_lines" -ge "$SHRINK_MIN_LINES" ] && [ $((new_lines * 2)) -lt "$old_lines" ]; then
          reasons+=("$path: shrank from $old_lines to $new_lines lines (truncated copy?)")
        fi
      fi ;;
  esac
  name="${newpath:-$path}"
  case "$(basename "$name")" in
    .env|.env.*|*.pem|*.key|id_rsa|id_ed25519|*.p12|*.pfx|*token*|*secret*)
      reasons+=("secret-looking file staged: $name") ;;
    *.bak|*.orig|*.rej|*~|*.drive-*|*.backup-*)
      reasons+=("backup/restore artefact staged: $name") ;;
  esac
done <<<"$status"

[ "$count" -gt "$MAX_FILES" ] && reasons+=("$count files changed > $MAX_FILES (mass change)")

if [ "${#reasons[@]}" -gt 0 ]; then
  {
    echo "chezmoi-sync-guard: BLOCKED — working tree looks wrong, nothing committed or pushed"
    printf ' - %s\n' "${reasons[@]}"
    echo "Inspect with: git -C $(pwd) diff --cached --stat"
    echo "If intentional: CHEZMOI_SYNC_ALLOW_MASS=1 $(dirname "$0")/chezmoi-sync.sh"
  } >&2
  exit 1
fi
exit 0
