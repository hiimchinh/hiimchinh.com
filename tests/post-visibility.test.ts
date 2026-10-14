import assert from "node:assert/strict";
import test from "node:test";
import { isPostVisible } from "../src/utils/post-visibility.ts";

const NOW = Date.parse("2026-10-14T10:00:00Z");
const MARGIN = 15 * 60 * 1000;
const PAST = "2026-10-01T00:00:00Z";
const FUTURE = "2026-11-01T00:00:00Z";
const production = { now: NOW, scheduledMargin: MARGIN, dev: false, preview: false };

test("production shows a published post", () => {
  assert.equal(isPostVisible({ pubDatetime: PAST }, production), true);
});

test("production hides a draft", () => {
  assert.equal(isPostVisible({ draft: true, pubDatetime: PAST }, production), false);
});

test("production hides a post scheduled in the future", () => {
  assert.equal(isPostVisible({ pubDatetime: FUTURE }, production), false);
});

test("production shows a post due within the scheduling margin", () => {
  const inTenMinutes = new Date(NOW + 10 * 60 * 1000).toISOString();
  assert.equal(isPostVisible({ pubDatetime: inTenMinutes }, production), true);
});

test("dev shows scheduled posts but still hides drafts", () => {
  const dev = { ...production, dev: true };
  assert.equal(isPostVisible({ pubDatetime: FUTURE }, dev), true);
  assert.equal(isPostVisible({ draft: true, pubDatetime: PAST }, dev), false);
});

test("a preview build shows drafts and scheduled posts for review", () => {
  const preview = { ...production, preview: true };
  assert.equal(isPostVisible({ draft: true, pubDatetime: PAST }, preview), true);
  assert.equal(isPostVisible({ pubDatetime: FUTURE }, preview), true);
});
