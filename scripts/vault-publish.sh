#!/usr/bin/env bash
# Publishes every daily draft the owner marked `status: done` in his Obsidian
# vault (second-brain repo, HC/blog-drafts/<slug>.md). For each one: write the
# post on a fresh branch, open a pull request as the owner's GitHub account
# (so "Owner approval" passes: he opened it by marking it done), wait for CI,
# merge, then write `status: published` and the URL back into the note. A draft
# that may not publish gets `status: blocked` and the reason instead.
# Runs from blog-vault-publish.timer on home-cook; the flow is in AGENTS.md.
#
# Env: VAULT (default ~/work/second-brain), REPO (default ~/work/hiimchinh.com),
#      VAULT_PUBLISH_DRY_RUN=1 stops before anything leaves the machine,
#      TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID for the result message (optional).
set -euo pipefail

VAULT=${VAULT:-$HOME/work/second-brain}
REPO=${REPO:-$HOME/work/hiimchinh.com}
DRAFTS=HC/blog-drafts
DRY_RUN=${VAULT_PUBLISH_DRY_RUN:-}
SITE=https://hiimchinh.com

notify() {
  echo "$1"
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || return 0
  # The token goes through stdin, never argv.
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$TELEGRAM_BOT_TOKEN" |
    curl -sS -o /dev/null --config - --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
      --data-urlencode "text=$1" || true
}

# Writes the status (and extra key=value pairs) into the note and pushes it.
mark() {
  local note=$1 rel
  shift
  rel=${note#"$VAULT"/}
  node "$REPO/scripts/vault-draft.mjs" set-status "$note" "$@"
  [ -n "$DRY_RUN" ] && { git -C "$VAULT" diff -- "$rel"; git -C "$VAULT" checkout -- "$rel"; return 0; }
  git -C "$VAULT" add -- "$rel"
  git -C "$VAULT" commit -q -m "blog: $(basename "$rel" .md) $1" -- "$rel"
  git -C "$VAULT" pull -q --rebase && git -C "$VAULT" push -q
}

block() {
  local note=$1 reason=$2
  mark "$note" blocked "blocked=$reason"
  notify "Blog: chưa đăng $(basename "$note" .md): $reason"
}

publish() {
  local note=$1 slug wt path pr sha url branch
  slug=$(basename "$note" .md)
  branch="vault/$slug-$(date +%y%m%d%H%M)"
  wt=$(mktemp -d)
  trap 'git -C "$REPO" worktree remove --force "$wt" >/dev/null 2>&1 || true' EXIT
  git -C "$REPO" fetch -q origin main
  git -C "$REPO" worktree add -q -b "$branch" "$wt" origin/main

  if ! path=$(node "$wt/scripts/vault-draft.mjs" to-post "$note" "$wt"); then
    block "$note" "$path"
    return
  fi
  (
    cd "$wt"
    corepack pnpm install --frozen-lockfile --silent
    corepack pnpm exec prettier --write --log-level warn "$path"
  )
  if ! test_log=$(cd "$wt" && corepack pnpm test 2>&1); then
    block "$note" "test lỗi: $(grep -m1 -E '^not ok|✖' <<<"$test_log" || echo 'xem log')"
    return
  fi
  if [ -n "$DRY_RUN" ]; then
    git -C "$wt" diff --stat
    git -C "$wt" status --short
    return
  fi

  git -C "$wt" add -- "$path"
  git -C "$wt" commit -q -m "content(post): publish $slug, finished by the owner in Obsidian"
  git -C "$wt" push -q -u origin "$branch"
  sha=$(git -C "$wt" rev-parse HEAD)
  pr=$(cd "$wt" && gh pr create --base main --head "$branch" \
    --title "content(post): publish $slug" \
    --body "The owner wrote the opening and the opinion and marked the draft done in Obsidian (scripts/vault-publish.sh).")
  # gh pr checks: 0 = all passed, 8 = pending, other = failed or none yet.
  local rc state=pending
  for _ in $(seq 60); do
    sleep 15
    rc=0
    gh pr checks "$pr" >/dev/null 2>&1 || rc=$?
    case $rc in
      0) state=passed; break ;;
      8) ;;
      *) gh pr checks "$pr" 2>&1 | grep -q "no checks reported" || { state=failed; break; } ;;
    esac
  done
  if [ "$state" != passed ]; then
    block "$note" "CI $state: $pr"
    return
  fi
  gh pr merge "$pr" --merge --match-head-commit "$sha" --delete-branch >/dev/null
  url="$SITE$([[ $path == */vi/* ]] && echo /vi)/posts/$slug/"
  mark "$note" published "url=$url"
  notify "Blog: đã đăng $url"
}

# One draft per child process, so `set -e` holds inside it.
if [ "${1:-}" = --one ]; then
  publish "$2"
  exit 0
fi

exec 9>"${XDG_RUNTIME_DIR:-/tmp}/blog-vault-publish.lock"
flock -n 9 || { echo "Another run holds the lock."; exit 0; }
git -C "$VAULT" pull -q --ff-only
git -C "$REPO" pull -q --ff-only
shopt -s nullglob
for note in "$VAULT/$DRAFTS"/*.md; do
  [ "$(node "$REPO/scripts/vault-draft.mjs" status "$note")" = "done" ] || continue
  "$0" --one "$note" ||
    notify "Blog: lỗi khi đăng $(basename "$note" .md), xem journalctl --user -u blog-vault-publish"
done
