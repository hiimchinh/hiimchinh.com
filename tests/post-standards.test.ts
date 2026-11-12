import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  MAX_PROSE_WORDS,
  STANCE_SINCE,
  WORD_LIMIT_SINCE,
  hasDraftNotes,
  postStandardViolations,
  proseWordCount,
  stanceInProse,
} from "../src/utils/post-standards.ts";
import { ownerWrote } from "../src/utils/vault-draft.ts";

const complete = {
  draft: false,
  pubDatetime: new Date("2026-10-14T17:30:00+07:00"),
  audience: "Developers moving a static site off Netlify",
  readerQuestions: ["q1", "q2", "q3"],
  readerCheck: { date: new Date("2026-10-14"), full: 3, total: 3 },
};

test("a published post with audience, questions and a full reader check passes", () => {
  assert.deepEqual(postStandardViolations(complete), []);
});

test("a published post must name its reader", () => {
  assert.deepEqual(postStandardViolations({ ...complete, audience: "" }), [
    "audience is missing",
  ]);
});

test("a published post needs at least three reader questions", () => {
  assert.deepEqual(
    postStandardViolations({
      ...complete,
      readerQuestions: ["q1", "q2"],
      readerCheck: { date: new Date("2026-10-14"), full: 2, total: 2 },
    }),
    ["readerQuestions needs at least 3 questions"]
  );
});

test("a published post must pass the reader check on every question", () => {
  assert.deepEqual(
    postStandardViolations({
      ...complete,
      readerCheck: { date: new Date("2026-10-14"), full: 2, total: 3 },
    }),
    ["readerCheck answered 2/3 questions in full; every question must be"]
  );
});

test("the reader check must cover the questions listed in the post", () => {
  assert.deepEqual(
    postStandardViolations({
      ...complete,
      readerQuestions: ["q1", "q2", "q3", "q4"],
    }),
    ["readerCheck covers 3 questions but the post lists 4"]
  );
});

test("a published post without a reader check fails", () => {
  assert.deepEqual(
    postStandardViolations({ ...complete, readerCheck: undefined }),
    ["readerCheck is missing"]
  );
});

test("drafts and posts from before the standard are exempt", () => {
  const bare = { pubDatetime: new Date("2021-05-01T00:00:00+07:00") };
  assert.deepEqual(postStandardViolations(bare), []);
  assert.deepEqual(
    postStandardViolations({
      draft: true,
      pubDatetime: new Date("2026-11-01"),
    }),
    []
  );
});

test("draft notes are detected in a post body", () => {
  assert.equal(hasDraftNotes("<!-- DRAFT NOTES FOR CHINH: x -->\nText"), true);
  assert.equal(hasDraftNotes("Text without notes"), false);
});

test("no published post still carries draft notes", async () => {
  const offenders: string[] = [];
  for (const locale of ["en", "vi"]) {
    const dir = new URL(`../src/content/posts/${locale}/`, import.meta.url);
    for (const name of await readdir(dir).catch(() => [])) {
      const text = await readFile(new URL(name, dir), "utf8");
      const isDraft = /^draft:\s*true\s*$/m.test(text.split(/^---$/m)[1] ?? "");
      if (!isDraft && hasDraftNotes(text)) offenders.push(`${locale}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});

const factChecked = {
  ...complete,
  pubDatetime: new Date("2026-10-28T07:00:00+07:00"),
  factCheck: { date: new Date("2026-10-28"), claims: 7, verified: 7 },
};

test("a post since the fact-check standard passes with every claim verified", () => {
  assert.deepEqual(postStandardViolations(factChecked), []);
});

test("a post since the fact-check standard without a fact check fails", () => {
  assert.deepEqual(
    postStandardViolations({ ...factChecked, factCheck: undefined }),
    ["factCheck is missing"]
  );
});

test("a post with an unverified claim fails", () => {
  assert.deepEqual(
    postStandardViolations({
      ...factChecked,
      factCheck: { date: new Date("2026-10-28"), claims: 7, verified: 6 },
    }),
    ["factCheck verified 6/7 claims; every claim must be"]
  );
});

test("a fact check with no claims fails, because a post with no facts has no proof", () => {
  assert.deepEqual(
    postStandardViolations({
      ...factChecked,
      factCheck: { date: new Date("2026-10-28"), claims: 0, verified: 0 },
    }),
    ["factCheck lists no claims"]
  );
});

test("posts before the fact-check standard do not need one", () => {
  assert.deepEqual(postStandardViolations(complete), []);
});

test("proseWordCount ignores frontmatter, comments and code blocks", () => {
  const text = [
    "---",
    'title: "Five words in the title"',
    "---",
    "<!-- DRAFT NOTES one two three -->",
    "One two three.",
    "```sh",
    "echo four five six",
    "```",
    "Four `inline` five.",
  ].join("\n");
  assert.equal(proseWordCount(text), 6);
});

test("posts since the word limit stay within the limit", async () => {
  const offenders: string[] = [];
  for (const locale of ["en", "vi"]) {
    const dir = new URL(`../src/content/posts/${locale}/`, import.meta.url);
    for (const name of await readdir(dir).catch(() => [])) {
      const text = await readFile(new URL(name, dir), "utf8");
      const pub = /^pubDatetime:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/m.exec(text)?.[1];
      // The owner's own words are not held to the agent's limits.
      if (!pub || new Date(pub) < WORD_LIMIT_SINCE || ownerWrote(text)) continue;
      const words = proseWordCount(text);
      if (words > MAX_PROSE_WORDS) offenders.push(`${locale}/${name}: ${words}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("proseWordCount strips ~~~ fences, indented fences and CRLF frontmatter", () => {
  assert.equal(proseWordCount("A b.\n~~~\none two three\n~~~\n"), 2);
  assert.equal(proseWordCount("A b.\n  ```\none two three\n  ```\n"), 2);
  assert.equal(proseWordCount("---\r\ntitle: a\r\n---\r\nOne two."), 2);
});

const withStance = {
  ...factChecked,
  pubDatetime: new Date("2026-11-10T07:00:00+07:00"),
  stance: "A guardrail that cannot fail loudly is decoration.",
};

test("a post since the stance standard passes with the owner's stance", () => {
  assert.deepEqual(postStandardViolations(withStance), []);
});

test("a post since the stance standard must state the owner's stance", () => {
  assert.deepEqual(
    postStandardViolations({ ...withStance, stance: " " }),
    ["stance is missing"]
  );
});

test("posts before the stance standard do not need one", () => {
  assert.deepEqual(postStandardViolations(factChecked), []);
});

test("stanceInProse finds the stance in prose, not in comments or code", () => {
  const stance = "Hooks beat rules.";
  assert.equal(stanceInProse("---\nstance: x\n---\nIntro. Hooks beat rules.\n", stance), true);
  assert.equal(stanceInProse("Intro.\n<!-- Hooks beat rules. -->\n", stance), false);
  assert.equal(stanceInProse("Intro.\n```\nHooks beat rules.\n```\n", stance), false);
});

test("every post since the stance standard says its stance in the text", async () => {
  const offenders: string[] = [];
  for (const locale of ["en", "vi"]) {
    const dir = new URL(`../src/content/posts/${locale}/`, import.meta.url);
    for (const name of await readdir(dir).catch(() => [])) {
      const text = await readFile(new URL(name, dir), "utf8");
      const front = text.split(/^---\s*$/m)[1] ?? "";
      const pub = /^pubDatetime:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/m.exec(front)?.[1];
      // The owner writes the opinion of a post he finished himself.
      if (!pub || new Date(pub) < STANCE_SINCE || ownerWrote(text)) continue;
      const stance = /^stance:\s*["']?(.+?)["']?\s*$/m.exec(front)?.[1] ?? "";
      if (!stance || !stanceInProse(text, stance)) offenders.push(`${locale}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});
