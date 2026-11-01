---
title: "An AI agent ran my Cloudflare account for five weeks: 184 actions, 23 approved by me"
description: "From 27 September to 1 November 2026 a coding agent ran 184 logged actions on my Cloudflare account; 23 of them carried one of 13 distinct approval quotes. The guardrails, the audit log, and the token exposure that forced a roll."
pubDatetime: 2026-11-02T07:00:00+07:00
draft: true
tags: ["ai-agents", "cloudflare", "opentofu", "security"]
audience: "Engineers who let a coding agent change their DNS and Cloudflare settings and want guardrails that hold"
readerQuestions:
  - "Is it safe to give an AI agent a Cloudflare token with almost full account access?"
  - "What stops the agent from deleting a zone or turning off the proxy?"
  - "Does this setup apply to me if several people share the Cloudflare account?"
  - "What went wrong when the agent got Cloudflare access?"
  - "How do I check what my agent changed and which changes I approved?"
factCheck:
  date: 2026-11-02
  claims: 28
  verified: 22
  owner: 6
---

<!-- DRAFT NOTES
Claims to confirm (only you can):
1. 27 Sep 2026: a DNS record kept pointing at the old server for hours after a move, because the DNS step was handed to you and nobody checked back.
2. The three tokens are IP-locked to the build server, and the operations token holds every account permission except API tokens (read and write), billing and account settings write.
3. The first wrapper put the token in curl's argv; all three token values were rolled on 28 Sep, 11:05-11:08, keeping ids, permissions and the IP lock.
4. The IP lock first held only IPv4; calls failed with error 9109 until the IPv6 /64 was added.
5. Until 27 Sep you made every Cloudflare change by hand in the dashboard.
-->

From 27 September to 1 November 2026, a coding agent ran 184 logged actions on my Cloudflare account: 48 OpenTofu applies and 136 raw API calls, 113 of them cache purges. 23 actions carried one of 13 distinct approval quotes; the other 161 needed none.

## Why I handed it over

Until then I made every Cloudflare change by hand in the dashboard. On 27 September a DNS record kept pointing at a server I had already moved away from, for hours. The agent had handed the DNS step to me, and nobody checked back. That evening I gave the agent account-wide tokens.

## Does this apply to you?

- **One person, a few zones, an agent that already writes your infrastructure code:** yes.
- **Several people share the account:** not as written. You need per-person audit and SSO first.
- **You cannot pin a token to one machine's IP:** no. The IP lock carries much of the safety.

## The guardrails

1. **Three account-owned tokens, IP-locked to one build server:** one only mints tokens, one operates (every account permission except API tokens read and write, billing and account settings write), one reads.
2. **One wrapper runs OpenTofu and raw API calls**, only on that server. Before an apply it also refuses a dirty or unpushed tree, or a `HEAD` without current `origin/main`.
3. **Most of the account is OpenTofu code**, changed by pull request: 56 merged PRs from 28 September to 1 November, 44 merged by the agent's bot account.
4. **Risky changes need a quote.** Any delete except a DNS record, turning a record's proxy off, security settings such as SSL, TLS and WAF, an update to a resource type the wrapper has not reviewed, and any non-GET API call outside a three-entry allowlist require `--owner-approved "<quote>"`. The quote goes into a JSON-lines audit log.
5. **A pre-tool hook** refuses agent commands that load the operations token directly, and loads of the mint-only token without an approval flag.
6. **A health job** verifies the tokens and runs a drift plan. From 26 October to 2 November it ran 9 times (8 in the nightly 03:00 slot, 1 at 09:28): 7 clean, 2 drift.

## What broke

- **The token was exposed in argv.** The first wrapper passed the token to `curl` as an argument. `/proc/<pid>/cmdline` was readable by every local user, and 3 CI runner accounts shared that server then (5 now), so the IP lock did not cover them. All three token values were rolled on 28 September in three minutes; Cloudflare's roll keeps the token id, permissions and IP lock. Since 18 October a hook refuses secrets in argv and `/proc` is mounted with `hidepid=invisible`.
- **The IP lock held only IPv4.** The server reaches the API over IPv6, so calls failed with error 9109 until the lock got the IPv6 /64.
- **2 of 136 API calls failed:** one HTTP 409, one HTTP 400.

## The trade-off

The cost is attention: 23 approved actions with 13 distinct quotes in 35 days, all from 13 October on. Three risks remain. A token with near-full account rights sits on a shared build server. The hook matches command patterns; it is not a sandbox. The wrapper only checks that a quote exists, so it cannot tell my words from words the agent wrote.

## Check your own agent's log

If your wrapper writes one JSON object per action, two `jq` lines show what it did and what claims approval. My log, as of 2 November 2026 06:36 +07:

```console
$ jq -r '.action // "apply"' cloudflare-applied.json | sort | uniq -c
    136 api
     48 apply
$ jq -c 'select(.owner_approved)' cloudflare-applied.json | wc -l
23
```

Then read each approved line and match its quote to a message you actually sent.
