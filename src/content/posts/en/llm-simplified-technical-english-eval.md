---
title: "Does a Simplified Technical English prompt make LLM output shorter? Five runs each"
description: "Asking Claude Sonnet to write 80% of the way to ASD-STE100 cut words per sentence from 12.0 to 8.5 over five runs each. It did not shorten the answers: 328 prose words against 312. One earlier run had shown 20% fewer."
pubDatetime: 2026-10-31T23:20:00+07:00
readerCheck:
  date: 2026-10-29
  full: 5
  total: 5
factCheck:
  date: 2026-10-31
  claims: 11
  verified: 11
tags: ["llm", "prompting", "evals"]
audience: "Engineers who have an LLM or agent write runbooks, handoffs or reports for people and want them easier to read"
readerQuestions:
  - "Does asking an LLM to write in Simplified Technical English make its output shorter?"
  - "What prompt do I use to get ASD-STE100 style output from an LLM?"
  - "Does Simplified Technical English make the model drop technical detail?"
  - "Does this apply to me if I write in a language other than English?"
  - "How do I check whether a style prompt worked on my own outputs?"
---

Asking Claude Sonnet to write "about 80% of the way to ASD-STE100" cut the average sentence from 12.0 to 8.5 words over five runs per prompt. It did not make the answers shorter: they averaged 328 prose words against 312 without the instruction.

A single run on 4 October 2026 had shown 20% fewer words, 296 against 370. I made the style part of my agents' writing rule for runbooks and handoffs that day. Five runs of each prompt on 29 October kept the short sentences and lost the shorter text.

## Does this apply to you?

- **An LLM writes English explanations for people:** yes, with a limit: one topic on one model was tested.
- **You write in another language:** unknown. Nothing here was tested in another language, so run the five-run test below with your own prompt first.
- **You want shorter output:** this instruction did not deliver it in these runs.

## The test

Both prompts ask the same thing: explain why `timestamptz` on a UTC server gives wrong day labels for a business in Vietnam, and how to fix it, in 250 to 350 words. The STE prompt adds one paragraph:

```text
Write it about 80% of the way to ASD-STE100 (Simplified Technical English): short sentences (procedural max 20 words, descriptive max 25), one idea per sentence, active voice, simple tenses, one meaning per word, write instructions as numbered imperative steps, put warnings before the step they apply to. Technical names (timestamptz, AT TIME ZONE, SQL) are allowed as technical names.
```

Each prompt ran five times with `claude -p --model sonnet --tools ""` in Claude Code 2.1.312. The ten runs took 2 minutes. On 4 October each prompt ran once, as a Claude Code subagent on Sonnet.

## How to check: count it

The script counts prose only, skipping fenced code, and checks for six facts a correct answer needs. Change `DETAILS` to the facts of your own topic.

````python
#!/usr/bin/env python3
"""Count words, sentences and concrete details in LLM explanations.
Usage: python3 -I count.py FILE...   (fenced code is excluded; a sentence ends at . ! ? before a capital or backtick, or at a line break)"""
import re, sys

DETAILS = {  # concrete facts a correct answer to the prompt should contain
    "AT TIME ZONE": r"AT TIME ZONE",
    "half-open range": r"half-open|\[from, *to\)|< *'?\d{4}-\d\d-\d\d",
    "23:59:59 warning": r"23:59:59",
    "bare date = UTC midnight": r"UTC midnight|00:00 UTC|07:00",
    "index / WHERE warning": r"\bindex",
    "SQL example": r"(?-i:\bSELECT\b|\bWHERE\b.*[<>]=?)",  # case-sensitive: prose "select" is not SQL
}

FENCE = re.compile(r"^[ \t]*```.*?^[ \t]*```[^\n]*$", re.S | re.M)  # fences may be indented in lists

def stats(text):
    code_lines = sum(m.group(0).count("\n") - 1 for m in FENCE.finditer(text))
    prose = FENCE.sub(" ", text)  # sentences are counted on prose only
    # a line break also ends a sentence: headings and list items carry no full stop
    sents = [s for line in prose.splitlines() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z`])", line)
             if re.search(r"\w", s)]
    words = [len(s.split()) for s in sents]
    found = [k for k, rx in DETAILS.items() if re.search(rx, text, re.I)]
    return sum(words), len(sents), round(sum(words) / len(sents), 1), max(words), sum(w > 20 for w in words), found, code_lines

for f in sys.argv[1:]:
    w, n, avg, mx, over, found, code = stats(open(f).read())
    print(f"{f}\tprose words {w}\tsentences {n}\tavg {avg}\tmax {mx}\t>20w {over}\tcode lines {code}\tdetails {len(found)}/{len(DETAILS)}")
````

```text
$ python3 count.py outputs/baseline-*.txt outputs/ste-*.txt
outputs/baseline-1.txt	prose words 302	sentences 23	avg 13.1	max 23	>20w 4	code lines 6	details 6/6
outputs/baseline-2.txt	prose words 308	sentences 26	avg 11.8	max 32	>20w 3	code lines 6	details 6/6
outputs/baseline-3.txt	prose words 328	sentences 25	avg 13.1	max 23	>20w 2	code lines 6	details 6/6
outputs/baseline-4.txt	prose words 293	sentences 24	avg 12.2	max 23	>20w 2	code lines 6	details 6/6
outputs/baseline-5.txt	prose words 329	sentences 33	avg 10.0	max 23	>20w 1	code lines 6	details 6/6
outputs/ste-1.txt	prose words 352	sentences 39	avg 9.0	max 19	>20w 0	code lines 6	details 6/6
outputs/ste-2.txt	prose words 354	sentences 40	avg 8.8	max 19	>20w 0	code lines 2	details 6/6
outputs/ste-3.txt	prose words 302	sentences 37	avg 8.2	max 17	>20w 0	code lines 6	details 6/6
outputs/ste-4.txt	prose words 309	sentences 40	avg 7.7	max 17	>20w 0	code lines 6	details 6/6
outputs/ste-5.txt	prose words 325	sentences 38	avg 8.6	max 23	>20w 1	code lines 6	details 6/6
```

## Results

|                               | Plain prompt (5 runs) | STE prompt (5 runs) |
| ----------------------------- | --------------------- | ------------------- |
| Prose words, mean (range)     | 312 (293–329)         | 328 (302–354)       |
| Sentences, mean               | 26.2                  | 38.8                |
| Words per sentence, mean      | 12.0                  | 8.5                 |
| Longest sentence, mean        | 24.8                  | 19.0                |
| Sentences over 20 words, mean | 2.4                   | 0.2                 |
| Facts found, of 6             | 6 in every run        | 6 in every run      |

## What the single run got wrong

On 4 October neither answer had an SQL example, so both score 5 of 6. A first version of the counter matched the word "select" in the plain answer's prose and scored it 6 of 6. That made the STE answer look as if it had lost detail. The `(?-i:…)` group now makes the SQL check case-sensitive.

In the ten new runs, one STE answer kept 2 lines of code where the others had 6.

Ten runs took 2 minutes. Run them before a single result becomes a rule.
