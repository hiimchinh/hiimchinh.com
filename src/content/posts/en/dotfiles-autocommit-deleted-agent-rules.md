---
title: "How a dotfiles auto-commit deleted three of my coding agents' rules, and the guard that blocks it now"
description: "On 23 September 2026 a 15-minute auto-commit pushed a stale copy of my agents' rule folder: 3 of 28 rules deleted, 12 rolled back. A guard now runs before every auto-commit; a replay of the failure prints BLOCKED and exits 1."
pubDatetime: 2026-10-30T07:00:00+07:00
draft: true
readerCheck:
  date: 2026-10-30
  full: 5
  total: 5
factCheck:
  date: 2026-10-30
  claims: 32
  verified: 32
tags: ["ai-agents", "git", "dotfiles"]
audience: "Developers who keep their coding agents' rules (CLAUDE.md, AGENTS.md, rule files) in a dotfiles repo that a job commits and pushes automatically"
readerQuestions:
  - "How do I stop an auto-commit job from pushing a broken copy of my agent rules?"
  - "Why did my check not run before chezmoi committed?"
  - "How can a script tell an edited file from one copied in by rsync or a restore?"
  - "Does this apply to me if I commit my dotfiles by hand?"
  - "How do I check that the guard actually blocks?"
---

<!-- DRAFT NOTES
Claims to confirm: on 23 September a sync script on your laptop mirrored its older ~/.agents to the server at about 01:18 (+07); the loss showed up at 01:23 while a new rule was being added.
-->

On 23 September 2026 at 01:20, a 15-minute auto-commit job pushed a stale copy of my coding agents' rule folder: 3 of 28 rules deleted, 12 rolled back to older text. A guard now runs before every auto-commit and refuses that shape; a replay of the failure prints `BLOCKED` and exits 1.

## Does this guide apply to you?

- **A timer commits and pushes the repo that holds your agent rules:** yes.
- **You use chezmoi with `git.autoCommit = true`:** yes, read the root cause first.
- **You commit your dotfiles by hand:** less so. You see the diff before the commit, and the guard runs only if you call it yourself.

## The setup

My agents read their global rules from `~/.agents/rules`. `~/.agents` is a symlink into my chezmoi source repo. A timer ran every 15 minutes: `chezmoi re-add`, commit, push. Every machine pulls that repo and regenerates each agent's rule files from it.

## Timeline (+07, from git log and the incident note of that night)

- **00:06** Last good commit: 28 rules.
- **01:18** A sync script on my laptop mirrored its own older `~/.agents` to the server with `rsync -az --delete`. Through the symlink it overwrote the repo.
- **01:20:00** The timer committed and pushed it: 30 files, 706 lines added, 942 deleted. Rules went from 28 to 25.
- **01:23** The loss showed up while a new rule was being added.
- **01:28** `git revert` restored all 28.

## Root cause

Two things lined up. `rsync --delete` wrote a stale tree through a symlink into a git working tree. And chezmoi's `git.autoCommit = true` with `autoPush = true` made `chezmoi re-add` commit and push the whole source before my script ran anything.

My first guard sat after `re-add`, so it never saw the change. Testing it at 01:50, chezmoi committed and pushed a deleted rule by itself: `Remove agents/rules/anti-overengineering.md`.

## The guardrail

1. `autoCommit = false` and `autoPush = false`, committed at 01:52. The sync script is now the only automatic commit path.
2. The guard runs after `git add -A` and before the commit. It blocks a deleted or renamed file under protected paths, more than 15 changed files, a modified file whose mtime is older than its last commit, a file that shrank below half, secret-looking names and backup files.

The mtime check catches copies. `rsync -a`, `rclone` or a restore keeps the old mtime; a real edit has a new one.

```bash
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
  # … secret-name and backup-file checks, then the file-count check
```

## How to check it blocks

Replay the failure in a throwaway repo: commit three rules, then `rsync -a --delete` an older copy over them with an August mtime and one rule missing. Save the [full guard](/code/dotfiles-autocommit-deleted-agent-rules/guard.sh) (67 lines) as `guard.sh` next to this script.

```bash
#!/usr/bin/env bash
# Reproduce the 23 Sep 2026 failure in a throwaway repo and show the guard refusing it.
# Usage: bash demo-stale-copy.sh   (needs git, rsync; guard.sh = copy of the real guard)
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
git init -q "$t/repo"; cd "$t/repo"
git config user.email demo@example.com; git config user.name demo
mkdir -p agents/rules
for r in tdd review banned-typefaces; do printf '# %s\nline 2 of the current rule\n' "$r" > agents/rules/$r.md; done
git add -A; git commit -qm "current rules"
# A stale copy from another machine: older text, older mtime, one rule missing.
mkdir -p "$t/stale/rules"
for r in tdd review; do printf '# %s\nold line 2\n' "$r" > "$t/stale/rules/$r.md"; done
touch -d '2026-08-26 10:00' "$t"/stale/rules/*.md
rsync -a --delete "$t/stale/rules/" agents/rules/
git add -A
echo "\$ git diff --cached --name-status"; git diff --cached --name-status
echo "\$ bash guard.sh; echo exit=\$?"
set +e; bash "$here/guard.sh" .; echo "exit=$?"
```

```text
$ git diff --cached --name-status
D	agents/rules/banned-typefaces.md
M	agents/rules/review.md
M	agents/rules/tdd.md
$ bash guard.sh; echo exit=$?
chezmoi-sync-guard: BLOCKED — working tree looks wrong, nothing committed or pushed
 - deletes protected file: agents/rules/banned-typefaces.md
 - agents/rules/review.md: mtime older than its last commit (stale copy?)
 - agents/rules/tdd.md: mtime older than its last commit (stale copy?)
exit=1
```

Two lines with local paths, before `exit=1`, were cut. The guard's own test script covers 11 cases:

```text
$ bash bin/test-chezmoi-sync-guard.sh | tail -1
passed=11 failed=0
```

## What it costs

- An intended mass change, such as renaming many rules, is blocked too. Run it once by hand with `CHEZMOI_SYNC_ALLOW_MASS=1` after reading `git diff --cached --stat`.
- A copy that sets new mtimes, such as `cp` without `-p`, passes the mtime check. The deletion, file-count and size checks still apply.
