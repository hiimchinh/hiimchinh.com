import assert from "node:assert/strict";
import test from "node:test";
import { tocEntries } from "../src/utils/toc.ts";

const h = (depth: number, slug: string, text: string) => ({ depth, slug, text });

test("toc keeps h2 as sections and h3 as sub-steps, drops other levels", () => {
  const headings = [
    h(1, "title", "Title"),
    h(2, "problem", "Problem"),
    h(3, "example", "Example"),
    h(4, "detail", "Detail"),
    h(2, "fix", "Fix"),
  ];
  assert.deepEqual(tocEntries(headings), [
    { slug: "problem", text: "Problem", sub: false },
    { slug: "example", text: "Example", sub: true },
    { slug: "fix", text: "Fix", sub: false },
  ]);
});

test("toc is empty when the post has fewer than two sections", () => {
  assert.deepEqual(tocEntries([h(2, "one", "One"), h(3, "child", "Child")]), []);
  assert.deepEqual(tocEntries([]), []);
});

test("h3 before the first h2 is not listed", () => {
  const headings = [h(3, "intro", "Intro"), h(2, "a", "A"), h(2, "b", "B")];
  assert.deepEqual(
    tocEntries(headings).map(e => e.slug),
    ["a", "b"]
  );
});

test("the inline remark-toc heading is not listed in the rail", () => {
  const headings = [
    h(2, "table-of-contents", "Table of contents"),
    h(2, "a", "A"),
    h(2, "b", "B"),
  ];
  assert.deepEqual(
    tocEntries(headings).map(e => e.slug),
    ["a", "b"]
  );
});
