import assert from "node:assert/strict";
import test from "node:test";
import { editRatio } from "../scripts/edit-ratio.mjs";

test("an unchanged draft has edit ratio 0", () => {
  assert.equal(editRatio("One two three.", "One two three."), 0);
});

test("one replaced word in four counts one deletion and one insertion", () => {
  assert.equal(editRatio("a b c d", "a x c d"), 0.5);
});

test("cutting half the draft gives 0.5", () => {
  assert.equal(editRatio("a b c d", "a b"), 0.5);
});

test("frontmatter and draft notes do not count as edits", () => {
  const draft = '---\ntitle: "x"\ndraft: true\n---\n<!-- DRAFT NOTES y -->\na b';
  const published = '---\ntitle: "x"\n---\na b';
  assert.equal(editRatio(draft, published), 0);
});
