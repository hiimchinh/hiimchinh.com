---
title: "Claude Code prompt cache: 1 hour or 5 minutes? A replay of 49 days of my transcripts"
description: "A replay of 49 days of my Claude Code transcripts at API prices: a 5-minute cache on the main thread raises its input-side cost 48.3%, a 1-hour cache on subagents cuts theirs 4.3%. Resuming idle 300k-context workers cost more; after a hook refused it, that share fell from 3.5% to 0.38% of subagent spend."
pubDatetime: 2026-11-03T07:00:00+07:00
draft: true
readerCheck:
  date: 2026-11-03
  full: 5
  total: 5
tags: ["ai-agents", "claude-code", "cost", "prompt-caching"]
audience: "Engineers running Claude Code with subagents every day who want to cut cost or usage-limit hits"
readerQuestions:
  - "Should I set Claude Code's prompt cache TTL to 1 hour or 5 minutes?"
  - "What costs more than the cache TTL in a Claude Code setup with subagents?"
  - "Does this apply to me if I only use the main thread and no subagents?"
  - "Did the changes reduce usage-limit hits?"
  - "How do I check which cache TTL my own Claude Code writes?"
factCheck:
  date: 2026-11-03
  claims: 25
  verified: 25
---

<!-- DRAFT NOTES
No owner-only claims: every number comes from the replay script, its PR, or a command in the ledger.
Dollars are API list-price equivalents, not what the subscription bills. Confirm you are fine publishing them.
-->

Switching Claude Code's prompt cache TTL was not worth it either way: on 49 days of my transcripts, a 5-minute cache raises the main thread's input-side cost 48.3% and a 1-hour cache cuts the subagents' by 4.3%. Resuming idle workers above 300k context cost more; after a hook started refusing it, that waste fell from 3.5% to 0.38% of subagent spend.

## Does this apply to you?

- **Claude Code with subagents, used for hours a day:** yes.
- **Main thread only, no subagents:** only the TTL result applies.
- **Short sessions without pauses over 5 minutes:** the TTL barely matters; a 5-minute cache rarely expires between your turns.

## How the replay works

A script parses every transcript and prices each call at API list prices. Then it replays the same calls under a counterfactual:

- **The other TTL.** A 5–60 minute pause after a 5-minute write turns a cache rebuild into a cache read under 1 hour, and the reverse.
- **A fresh worker instead of a resume.** An idle worker above 300k context is priced as a new worker with a 100k re-read and a 5k brief.

All dollars are API list-price equivalents, not what a subscription bills. The 49-day replay, 3 September to 21 October 2026, ran in 22 seconds.

## Results, 49 days

| Change                                          | Effect            | Base                        |
| ----------------------------------------------- | ----------------- | --------------------------- |
| Main thread 1 h → 5 min                         | +48.3%            | main-thread input-side cost |
| Subagents 5 min → 1 h                           | −4.3%             | subagent input-side cost    |
| Fresh worker instead of resuming one above 300k | −8.72% ($59/week) | all subagent spend          |

Input-side cost is cache writes, cache reads and uncached input; output tokens are the same under any TTL.

Under a 5-minute TTL, every 5–60 minute pause between main-thread turns rebuilds the cache. Separately, calls above 400k context made 25.8% of main-thread spend and 37.9% of subagent spend over those 49 days, and 12.4% and 12.6% in the latest 14.

## What I changed

1. **Kept the defaults:** 1 hour on the main thread, 5 minutes on subagents.
2. **Added a pre-tool hook** that refuses `SendMessage` to a subagent above 300k context that has been idle for 60 seconds, so the agent spawns a fresh worker with a brief. A `[keep-context: <reason>]` tag overrides it.
3. **Made the replay weekly:** a timer every Monday 07:30 prices the last 14 days and flags levers over their thresholds, such as TTL ≥5% and resume ≥3% of subagent spend, if they are also worth ≥$10/week.

In the 14 days before the hook merged on 21 October, the resume waste was 3.49% ($19.47/week). In the 14 days to 3 November 06:33 +07, which start one day before the merge, it was 0.38% ($0.63/week). Neither TTL switch is worth it yet: 1 hour on subagents would cut their input-side cost 1.58%; 5 minutes on the main thread would raise its 19.39%.

## What went wrong

- **The first analysis was wrong.** Over the 49 days it overcounted the injected resource-warning text and reported 2.5% of main-thread spend; the replay measures 0.63%. Code review caught it. Cost numbers now come only from the script.
- **Usage-limit hits went up.** The replay prices dollars, not limits: 33 limit hits in the 14 days to 3 November, against 24 in the 14 days before the hook.

## The cost

The replayed spend for those 14 days is $1,887 at list prices: $1,557 main thread, $330 subagents. The weekly check takes 11 seconds.

## Check which TTL your Claude Code writes

Sum cache-write tokens by TTL in transcripts changed in the last 14 days. Only `jq` is needed:

```bash
cd ~/.claude/projects
find . -name '*.jsonl' -newermt "$(date -d '14 days ago' +%F)" -print0 | xargs -0 cat \
  | jq -r 'select(.message.usage.cache_creation)
      | [(if .isSidechain then "subagent" else "main" end),
         .message.usage.cache_creation.ephemeral_1h_input_tokens,
         .message.usage.cache_creation.ephemeral_5m_input_tokens] | @tsv' \
  | awk -F'\t' '{h[$1]+=$2; m[$1]+=$3} END {for (k in h) printf "%-8s 1h=%d 5m=%d\n", k, h[k], m[k]}' | sort
```

My output on 3 November 2026 06:34 +07:

```console
main     1h=208459501 5m=0
subagent 1h=13968 5m=56169305
```

Main-thread writes are all 1 hour; subagent writes are 99.98% 5 minutes.
