---
title: "How to make Claude Code follow a rule: a PreToolUse hook that refused git commit -a 40 times"
description: "A 30-line PreToolUse hook refuses git commit -a and names the safe command. From 15 to 26 October 2026 agents tried it 40 times; the hook refused all 40, and 36 times the agent's next command staged named files."
pubDatetime: 2026-10-28T10:51:00+07:00
tags: ["claude-code", "ai-agents", "git"]
audience: "Developers who use Claude Code or another coding agent every day and keep repeating the same instructions"
readerQuestions:
  - "Why does my agent ignore the rules in CLAUDE.md?"
  - "How do I write a hook that blocks a wrong command, with a working example?"
  - "Which rules should be a hook and which can stay as text?"
  - "How do I check that my hook actually blocks?"
readerCheck:
  date: 2026-10-28
  full: 4
  total: 4
factCheck:
  date: 2026-10-28
  claims: 32
  verified: 32
---

From 15 to 26 October 2026, my coding agents tried `git commit -a` 40 times, and a 30-line hook refused all 40. In 36 of those cases the agent's next command was `git add` with only its own files.

## Does this guide apply to you?

- **Claude Code:** yes, the hook uses its `PreToolUse` format.
- **An agent without pre-command hooks:** the idea carries over, the code does not.
- **A rule that needs judgment,** such as "reply in Vietnamese": a script cannot decide it; keep it as text.

## What broke

I run several agent sessions in one checkout. On 14 October at 22:12, one of them committed a test fix with `git commit -qam`. Twenty of the commit's 21 files were another session's unfinished work. The revert went in at 22:14.

## Why a text rule did not stop it

At 22:16 a memory note told agents to stage only their own files. After the note, agents still ran `git commit -a` twice before the hook existed. From 1 October to the hook, 58 such commands ran; none was refused.

Claude Code's docs say why: Claude treats CLAUDE.md "as context, not enforced configuration". A hook runs before the command and can refuse it. Make a rule a hook when a script can decide it from the command alone.

## The hook

It reads the tool call as JSON on stdin and prints a `deny` with a reason. The agent reads the reason, so the reason names the fix. `shlex` splitting lets a commit message that mentions `-a` pass.

```python
#!/usr/bin/env python3
import json, re, shlex, sys
def stages_all(cmd):
    cmd = re.sub(r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?\n\s*\1\s*(?=\n|$)", "", cmd, flags=re.S)
    lex = shlex.shlex(cmd.replace("\n", ";"), posix=True, punctuation_chars=True)
    lex.whitespace_split = True
    try:
        words = list(lex)
    except ValueError:
        return False
    seg = []
    for w in words + [";"]:
        if re.fullmatch(r"[;&|()]+", w):
            if "git" in seg and "commit" in seg[seg.index("git"):]:
                for opt in seg[seg.index("commit") + 1:]:
                    if opt == "--": break
                    if opt == "--all" or re.fullmatch(r"-[^-a]*a\w*", opt) and not re.match(r"-[^a]*[mFCctS]", opt):
                        return True
            seg = []
        else:
            seg.append(w)
    return False
cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
if stages_all(cmd):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "git commit -a stages other sessions' edits. "
            "Run git status --short, git add <your files>, git commit -m.",
    }}))
```

The first `re.sub` drops heredoc bodies, so text inside a heredoc is never read as a command.

Register it in `~/.claude/settings.json`:

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "python3 ~/hooks/block-commit-all.py", "timeout": 5 }
      ]
    }
  ]
}
```

## How to check that it blocks

Feed it fake tool calls (needs `jq`):

```
$ jq -nc '{tool_name:"Bash",tool_input:{command:"git commit -qam \"fix: typo\""}}' | python3 block-commit-all.py
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "git commit -a stages other sessions' edits. Run git status --short, git add <your files>, git commit -m."}}
$ jq -nc '{tool_name:"Bash",tool_input:{command:"git commit -m \"docs: explain the -a flag\""}}' | python3 block-commit-all.py
$
```

An allowed command prints nothing. Then ask a new session to run `git commit -am test`; it must fail with your reason. Mine went in on 15 October at 09:34; a test call was refused at 09:42, the first real one at 09:51.

## What happened after

- Refused: 40 of 40 tries, 15 October 09:43 to 27 October 00:00 (+07).
- Next command: 36 times `git add <files>`, 4 times `git status`.
- Cost: 0.02 seconds per call in five timed runs.

Replayed over 59,263 Bash commands from my transcripts (1 to 26 October), the version above blocks the same 99 as my 165-line production hook, plus 2 where the commit follows a `)`.

## What it misses

- `bash -c 'git commit -am x'` passes, because `shlex` reads the quoted text as one word.
- It also blocks `-a` in a worktree that only one session uses, where `-a` is safe.

My production hook's message ends with "For longer work use a separate `git worktree`." A worktree has its own index, so `-a` there sweeps only its own edits.

My order for any rule: make it the default, else block it with a hook, else fail it in CI, and only then write it down.
