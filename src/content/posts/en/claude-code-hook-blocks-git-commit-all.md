---
title: "How to make Claude Code follow a rule: a PreToolUse hook that refused git commit -a 40 times"
description: "A 33-line PreToolUse hook refuses git commit -a and names the safe command. From 15 to 26 October 2026 agents tried it 40 times; the hook refused all 40, and 36 times the agent's next command staged named files."
pubDatetime: 2026-10-28T06:30:00+07:00
draft: true
tags: ["claude-code", "ai-agents", "git"]
audience: "Developers who use Claude Code or another coding agent every day and keep repeating the same instructions"
readerQuestions:
  - "Why does my agent ignore the rules in CLAUDE.md?"
  - "How do I write a hook that blocks a wrong command, with a working example?"
  - "Which rules should be a hook and which can stay as text?"
  - "How do I check that my hook actually blocks?"
readerCheck:
  date: 2026-10-27
  full: 4
  total: 4
factCheck:
  date: 2026-10-27
  claims: 32
  verified: 32
---

<!-- DRAFT NOTES
OUTLINE for Chinh to write in his own words (owner 27/10: the AI draft read as AI).
Every number below was reproduced from the transcripts with the scripts in the private ledger
(blog-ideas/claims/claude-code-hook-blocks-git-commit-all/). Keep the numbers; write the rest your way.
After you write it, the agent re-runs the fact check and the reader check, and updates factCheck/readerCheck.
Target: ≤600 words of prose, the result in the first two sentences.
-->

## Outline

**Opening (2 sentences, the result first)**
- A hook refused `git commit -a` every time an agent tried it: 40 of 40, 15–26 Oct 2026.
- In 36 of the 40, the agent's next command staged only its own files.

**1. What broke (your story, short)**
- 14 Oct, 22:12: an agent ran `git commit -qam` for a test fix in a checkout shared by several sessions.
- The commit had 21 files; 20 were another session's unfinished work. Reverted at 22:14.
- Your words: what you saw, how you found it, how it felt to clean up.

**2. Why a text rule did not stop it**
- 22:16 the same night: a memory note told agents to stage only their own files.
- Before the hook existed, agents still ran `git commit -a` 2 more times.
- From 1 Oct to the hook: 58 such commands, none refused.
- Quote the Claude Code docs: CLAUDE.md is "context, not enforced configuration".
- Your words: why you stopped trusting text rules.

**3. The hook (your real one, not a toy)**
- PreToolUse on Bash, reads the command from stdin, prints a `deny` with a reason that names the safe command.
- Committed 15 Oct 09:34, tested 09:42, first real refusal 09:51.
- Show a short excerpt of your real hook (or the deny message), not the whole file.
- Your words: why the reason text matters (the agent reads it and fixes itself).

**4. How you know it works**
- 40 tried, 40 refused (15 Oct 09:43 – 26 Oct 24:00 +07).
- Next command: 36 `git add <files>`, 4 `git status`.
- 0.02 s per call.
- How to test yours: feed a fake tool call with `jq`, then ask a real session to run the wrong command.

**5. Limits and what you would do instead**
- `bash -c 'git commit -am x'` gets through.
- It also blocks `-a` in a worktree that one session owns, where `-a` is safe.
- The better default: one `git worktree` per session.
- Your rule of thumb: default > block > gate > instruct.
