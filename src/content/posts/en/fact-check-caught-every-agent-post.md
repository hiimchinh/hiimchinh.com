---
title: "A blind fact-check rejected claims in all 7 posts my AI agent drafted"
description: "My agent lists every claim in a post with a source and a command. A second model, blind to the writer's verdicts, reruns them. Its first pass rejected at least one claim in all 7 posts published from 28 October to 9 November 2026; where it counted, 12 of 119 claims were unsupported or wrong."
pubDatetime: 2026-11-10T07:00:00+07:00
draft: true
tags: ["ai-agents", "evals", "claude-code", "fact-checking"]
stance: "Agents make the mistakes now, so rules belong in the harness as hooks, defaults and checks, not in advice."
audience: "Engineers who publish text an AI agent drafts from their own logs and data, and want the facts in it to hold"
readerQuestions:
  - "How often does an AI agent get facts wrong when it writes from my own logs?"
  - "How do I set up an independent fact-check for AI-written posts?"
  - "Is one fact-check pass enough?"
  - "Does this apply to me if the agent writes code or opinion pieces?"
  - "How do I check that every claim in a post was verified before it ships?"
factCheck:
  date: 2026-11-10
  claims: 19
  verified: 16
  owner: 3
---

<!-- DRAFT NOTES
Claims to confirm (only you can):
1. On 27 October you decided the agent writes a post a day and you review and edit it.
2. On 27 October you rejected a full agent draft as obviously AI-written.
-->

My agent drafts the posts on this blog, and a second model checks every claim before I see a draft. Its first pass rejected at least one claim in each of the 7 posts published from 28 October to 9 November 2026; in the 4 posts where it kept counts, 12 of 119 claims were unsupported or wrong.

## Does this apply to you?

- **An agent drafts text from your logs or data:** yes. You need a claims file and a second model.
- **The agent writes code:** tests already do most of this job; this post covers prose.
- **Opinion pieces with no numbers:** no. The audit needs a source to open.

## The setup

On 27 October I decided my agent would write a post a day and I would review and edit it. The same day the fact-check became part of the build, for posts from 28 October:

1. The writing agent lists every factual claim in a private ledger, with its source and, for a number, the script and command that reproduce it.
2. A fresh subagent on a different model from the writer gets the post, the sources and the commands, but not the writer's verdicts. It must open each source and rerun each command, then mark each claim VERIFIED, UNSUPPORTED or WRONG.
3. The writer fixes or cuts until every claim is VERIFIED. A claim only I can vouch for is marked OWNER, and I confirm it before I approve.
4. The build fails unless verified plus owner-confirmed claims equal the claim count in the post's `factCheck` frontmatter.

## First-audit results

| Post                                                                    | Claims  | Unsupported | Wrong |
| ----------------------------------------------------------------------- | ------- | ----------- | ----- |
| [git commit -a hook](/posts/claude-code-hook-blocks-git-commit-all/)    | 23      | 3           | 1     |
| [PHP2Shell check](/posts/check-php2shell-patch-without-version-number/) | 36      | 1           | 0     |
| [STE eval](/posts/llm-simplified-technical-english-eval/)               | 28      | 2           | 2     |
| [dotfiles auto-commit](/posts/dotfiles-autocommit-deleted-agent-rules/) | 32      | 2           | 1     |
| **Total**                                                               | **119** | **8**       | **4** |

The first audits of the other 3 posts list what they rewrote instead of counts: 4, 5 and 2 items.

## What it caught

- **Scope wider than the evidence.** A guard was said to catch copies in hand commits; it runs only when called.
- **Wrong names.** `lsphp` was listed as a PHP web binary. A folder was called the symlink when its parent was.
- **A measurement bug that flipped a result.** The STE eval's SQL check ran with `re.I` and matched the prose "To select 1 to 3 October". The post said the STE prompt dropped an SQL example the plain prompt kept. Neither answer had one.

## One pass is not enough

4 posts got a further check after the fixes, and each one changed something more: the CI runner count on the incident day, the wording of approvals, a "largest share" claim, an "applies to you" line wider than the test. That is 13 audit runs for 7 posts.

## What it does not catch

The audit checks facts, not voice. On 27 October I rejected a full draft as obviously AI-written; no claims check catches that. And 10 claims across 3 posts are OWNER: they rest on my word or my own notes, and the auditor cannot rerun me.

## Check your own pipeline

My ledgers record each audit. A script reads them:

```console
$ python3 count-audits.py | tail -1
TOTAL posts=7 audit_runs=13 posts_with_2plus_runs=4 first_audit_bad=12/119 owner_only=10
```

If your pipeline cannot print a line like this, it has no record that a check ran.

Agents make the mistakes now, so rules belong in the harness as hooks, defaults and checks, not in advice. "Check your facts" in a prompt is advice; a build that fails on an unchecked claim is a rule.
