import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  hasDraftNotes,
  postStandardViolations,
} from "../src/utils/post-standards.ts";

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
