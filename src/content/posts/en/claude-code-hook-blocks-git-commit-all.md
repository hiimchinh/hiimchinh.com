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
Claims to confirm: the incident of 14 October (21 files committed, 20 reverted two minutes later);
the counts below come from a script over local Claude Code transcripts, windows in +07.
-->

A PreToolUse hook in Claude Code refuses `git commit -a` and tells the agent the safe command. From 15 October 09:43 to 26 October 24:00 (+07), agents in my sessions tried `git commit -a` 40 times; the hook refused all 40, and 36 times the agent's next command staged named files with `git add`.

## Does this guide apply to you?

It applies to Claude Code and to rules visible in the command string.

## What broke

I run several agent sessions in one checkout. `git commit -a` stages every tracked change, including another session's unfinished edits.

On 14 October at 22:12 an agent ran `git commit -qam` for a test fix. The commit changed 21 files; 20 were another session's redesign work. The revert landed at 22:14.

## Why a text rule was not enough

At 22:16 that night a memory note told agents to stage only their own files. Before I committed the hook at 09:34 the next morning, agents ran `git commit -a` twice more, and nothing stopped them. The Claude Code memory docs say why: Claude treats CLAUDE.md "as context, not enforced configuration". The agent weighs the rule against its task, and nothing checks the command. A hook is a script that runs before every command and can refuse it.

From 1 October 00:00 to the hook, agents issued 58 such commands and none was refused.

My order of preference for any "should":

1. **Default:** the tool already does the right thing.
2. **Block:** a hook refuses the wrong shape and names the right command.
3. **Gate:** CI fails.
4. **Instruct:** a line in CLAUDE.md, alone only for rules that need judgment.

Make a rule a hook when a script can decide it from the tool call alone. A rule that needs judgment, such as "reply in Vietnamese", stays as text. Other hooks in my settings refuse a token variable in a `curl` header and a `while` loop that polls `pgrep -f`.

## Step 1: write the hook

The hook reads the tool call as JSON on stdin. To refuse, it prints a `deny` decision. The reason goes back to the agent, so it names the fix. It splits the command with `shlex`, so a commit message that mentions `-a` passes.

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
                    if opt == "--":
                        break
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

I replayed it over 59,263 Bash commands from my transcripts (1 October 00:00 to 27 October 00:00). It blocks the same 99 commands as my 165-line production hook. It also blocks 2 that the long hook misses, where `git commit` with `-a` follows a `)`.

## Step 2: register it

Add it to `~/.claude/settings.json`:

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

## Step 3: prove it blocks

Feed it fake tool calls (needs `jq`):

```
$ jq -nc '{tool_name:"Bash",tool_input:{command:"git commit -qam \"fix: typo\""}}' | python3 block-commit-all.py
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "git commit -a stages other sessions' edits. Run git status --short, git add <your files>, git commit -m."}}
$ jq -nc '{tool_name:"Bash",tool_input:{command:"git commit -m \"docs: explain the -a flag\""}}' | python3 block-commit-all.py
$
```

An allowed command prints nothing. In a new session, ask the agent to run `git commit -am test`. The call must fail with your reason. My production hook returns this text to the agent:

```
PreToolUse:Bash hook error: `git commit -a` / `--all` stages every tracked modification in the checkout, including uncommitted edits of other agent sessions that share it (2026-10-14: `git commit -qam` swept 20 files of another session's work into main). Instead: run `git status --short`, stage only your own files with `git add <your files>`, then `git commit -m "..."`. For longer work use a separate `git worktree`.
```

A test call in a throwaway repository was refused at 09:42 on 15 October; the first refusal of real work came at 09:51.

## What the agent did next

- 36 of 40: staged named files with `git add`.
- 4 of 40: ran `git status` to see what had changed.

## What it costs and what it misses

- The short hook took 0.02 seconds per call in each of five timed runs on 27 October.
- It also blocks `-a` in a worktree that one session owns, where `-a` is safe.
- `bash -c 'git commit -am x'` passes, because `shlex` reads the quoted text as one word.
- The production hook's message also says: "For longer work use a separate `git worktree`." A worktree has its own index, so `-a` there sweeps only that worktree's edits.
