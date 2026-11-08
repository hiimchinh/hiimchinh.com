---
title: "My agents' git freshness hook did nothing for at least 55 days after I moved them to Linux"
description: "A hook that fetches before my coding agents read git state returned 0 on every call for at least 55 days, because it looked for ~/Work on a Linux server that keeps repos in ~/work. On 9 November 2026, 29 of 47 local default branches were behind origin; after one run of the fixed hook, 19 were."
pubDatetime: 2026-11-09T07:00:00+07:00
draft: true
tags: ["ai-agents", "claude-code", "git", "hooks"]
audience: "Engineers who run coding agents on a server and rely on hooks to keep the agents' git view current"
readerQuestions:
  - "Why did my coding agent say a branch was not merged when it was?"
  - "How do I keep local git refs fresh for an AI coding agent automatically?"
  - "How can a Claude Code hook fail without anyone noticing?"
  - "Does this apply to me if I work on a laptop, not a server?"
  - "How do I check that my freshness hook actually ran?"
factCheck:
  date: 2026-11-09
  claims: 23
  verified: 21
  owner: 2
---

<!-- DRAFT NOTES
Claims to confirm (only you can):
1. 20 Aug 2026: the agent reported the branch as "pushed, no PR" and you asked why it was not merged.
2. Local main was 75 commits behind origin/main and `git log main..branch` showed 70 commits (from the incident note).
-->

My git freshness hook, which fetches before my coding agents read git state, returned 0 on every call for at least 55 days and refreshed nothing. On 9 November 2026, 29 of the 47 local default branches on my build server were behind `origin`; after one run of the fixed hook, 19 were.

## Does this apply to you?

- **Agents on a second machine, a server or a container** with a different home layout: yes. Check that the hook's report exists there.
- **Agents only on the laptop where you wrote and tested the hook:** the path bug does not; the silent `|| true` lesson still does.
- **No hooks at all:** compare against `origin/<branch>` after a `git fetch`, never against a local `main`.

## Why the hook exists

On 20 August 2026 an agent told me a branch was pushed but had no pull request. It had merged through two PRs, on 17 and 19 August. The local `main` was 75 commits behind `origin/main`, so `git log main..branch` showed 70 commits that looked unmerged.

The fix: two Claude Code hooks run one script, before every `git` command for that repo and at session start for all repos. The two entries in `~/.claude/settings.json` (path shortened, other keys removed):

```json
"PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "if": "Bash(git *)", "timeout": 25,
  "command": "python3 ~/scripts/git-freshness.py --mode touch 2>/dev/null || true" }] }],
"SessionStart": [{ "hooks": [{ "type": "command", "async": true,
  "command": "python3 ~/scripts/git-freshness.py --mode prime 2>/dev/null || true" }] }]
```

Per repo, the script runs one fetch:

```bash
git -C "$repo" fetch origin --prune --no-tags '+refs/heads/*:refs/remotes/origin/*' "main:main"
```

The second refspec has no `+`, so git refuses any update to `main` that is not a fast-forward and local commits stay. A 15-minute stamp skips the network on repeat calls.

## How it broke

The defaults named the Mac's folders: repos in `~/Work`, the report in `~/Library/Logs`. Then I moved the agents to a Linux server, where repos live in `~/work`; the hooks are in its config history from 15 September. On that file system `~/Work` does not exist, so both modes returned 0:

- `prime` found no repo and returned 0.
- `touch` skipped every path, because none started with `~/Work`.
- The hook command ends in `2>/dev/null || true`, so nothing could surface.

No report file ever existed on the server.

## Before and after

A script fetched each repo and counted how far its local default branch was behind `origin`:

|                              | Default branches behind origin |
| ---------------------------- | ------------------------------ |
| Before the fix, 06:33        | 29 of 47                       |
| After one `prime` run, 06:35 | 19 of 47                       |

That `prime` run made 56 report entries: 11 fast-forwarded (10 of them among the 47 measured; one was an agent worktree), 35 skipped because the repo had its default branch checked out, 5 without an origin, 3 without a local default branch, 2 already current.

## What still fails

Git will not fast-forward a branch that is checked out. Those repos stay behind locally, and the report records how far. Their `origin/*` refs are fresh, so an agent that compares against `origin/main` gets the right answer, and one that compares against `main` still does not.

## The guardrail on the guardrail

1. The defaults now cover `~/work` and `~/Work`, deduplicated.
2. Off macOS, the cache and report move to `~/.cache` and `~/.local/state`.
3. When no repo root exists, `prime` writes the error into the report and exits 1, so a later reader sees it even when stderr is discarded.

Two tests reproduce the failure, one per case.

## The cost

A cold `touch` on my infrastructure repo took 1.34 s; the next two calls took 0.09 s and 0.07 s from the stamp. A repeat `prime` over all repos took 12.6 s, in the background at session start.

## Check your own hook

My output at 06:37:

```console
$ ls -l ~/.local/state/git-freshness/git-freshness.json
-rw-rw-r-- 1 chinh chinh 16897 Nov  9 06:36 /home/chinh/.local/state/git-freshness/git-freshness.json
$ jq -r '.error // empty, (.repos[] | .action)' ~/.local/state/git-freshness/git-freshness.json | sort | uniq -c
     10 fast-forwarded
     35 skipped-checked-out
      1 skipped-fresh
      3 skipped-no-local-branch
      5 skipped-no-origin
      2 up-to-date
```

A later `touch` rewrote one entry as `skipped-fresh`.

No file, or a file older than your last session, means the hook is not running, whatever its exit code says.
