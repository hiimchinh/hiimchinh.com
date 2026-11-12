import assert from "node:assert/strict";
import test from "node:test";
import {
  draftStatus,
  draftToPost,
  ownerWrote,
  provenanceKey,
} from "../src/utils/vault-draft.ts";

const NOW = new Date("2026-11-13T09:05:00+07:00");

const draft = (body: string, status = "done") =>
  [
    "---",
    `status: ${status}`,
    "locale: en",
    'title: "Netplan lost the network"',
    "pubDatetime: 2026-11-11T07:00:00+07:00",
    "draft: true",
    'stance: "Fix the cause once."',
    "---",
    "",
    body,
  ].join("\n");

test("draftStatus reads the status the owner sets in Obsidian", () => {
  assert.equal(draftStatus(draft("Text.", "done")), "done");
  assert.equal(draftStatus(draft("Text.", "draft")), "draft");
  assert.equal(draftStatus("No frontmatter."), undefined);
});

test("a done draft becomes a published post dated now, marked as finished by the owner", () => {
  const { post, locale, problems } = draftToPost(
    draft("I wrote this opening.\n\nBody."),
    NOW
  );
  assert.deepEqual(problems, []);
  assert.equal(locale, "en");
  assert.equal(
    post,
    [
      "---",
      'title: "Netplan lost the network"',
      "pubDatetime: 2026-11-13T09:05:00+07:00",
      'stance: "Fix the cause once."',
      "ownerDone: 2026-11-13",
      "---",
      "",
      "I wrote this opening.",
      "",
      "Body.",
      "",
    ].join("\n")
  );
});

test("questions for the owner and draft notes are removed on publish", () => {
  const body = [
    "> [!question] Confirm",
    "> 1. You allowed the reboot.",
    "",
    "<!-- DRAFT NOTES",
    "claim 1",
    "-->",
    "",
    "Opening.",
  ].join("\n");
  const { post, problems } = draftToPost(draft(body), NOW);
  assert.deepEqual(problems, []);
  assert.match(post, /---\n\nOpening\.\n$/);
});

test("a draft with a slot the owner has not written yet is refused", () => {
  const body = [
    "> [!todo] Chính viết: mở bài",
    "> Nói vì sao mất mạng.",
    "",
    "Body.",
    "",
    "> [!todo] Chính viết: quan điểm",
  ].join("\n");
  assert.deepEqual(draftToPost(draft(body), NOW).problems, [
    "Chính chưa viết: mở bài",
    "Chính chưa viết: quan điểm",
  ]);
});

test("a draft without frontmatter is refused", () => {
  assert.deepEqual(draftToPost("Just text.", NOW).problems, [
    "thiếu frontmatter",
  ]);
});

test("the locale defaults to English and can be Vietnamese", () => {
  assert.equal(
    draftToPost(draft("Text.").replace("locale: en\n", ""), NOW).locale,
    "en"
  );
  assert.equal(
    draftToPost(draft("Text.").replace("locale: en", "locale: vi"), NOW).locale,
    "vi"
  );
});

test("ownerWrote is true only for a post the owner finished in Obsidian", () => {
  assert.equal(ownerWrote("---\ntitle: a\nownerDone: 2026-11-13\n---\nText"), true);
  assert.equal(ownerWrote("---\ntitle: a\n---\nownerDone: 2026-11-13"), false);
});

test("the note under a post says who wrote which part", () => {
  const checked = { factCheck: { claims: 3 } };
  assert.equal(provenanceKey({ ...checked, ownerDone: new Date() }), "ownerWrote");
  assert.equal(provenanceKey(checked), "agentDrafted");
  assert.equal(provenanceKey({}), undefined);
});
