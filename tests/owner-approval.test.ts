import assert from "node:assert/strict";
import test from "node:test";
import { postStandardViolations } from "../src/utils/post-standards.ts";
import {
  countLedgerClaims,
  ownerApprovalVerdict,
  ownerClaimsIn,
  publishesPost,
} from "../src/utils/owner-approval.ts";

const HEAD = "99e5142aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OLD = "274b103bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const post = (fields: string) =>
  `---\ntitle: x\npubDatetime: 2026-11-01T06:30:00+07:00\n${fields}---\n\nBody.\n`;

test("a ledger counts VERIFIED and OWNER claims from the status column", () => {
  const ledger = [
    "| # | claim | source | status |",
    "|---|---|---|---|",
    "| 1 | a | git log | VERIFIED |",
    "| 2 | b | output | VERIFIED |",
    "| 3 | c | transcript | VERIFIED |",
    "| 4 | d | owner's Mac log | OWNER |",
  ].join("\n");
  assert.deepEqual(countLedgerClaims(ledger), {
    claims: 4,
    verified: 3,
    owner: 1,
    invalid: [],
  });
});

test("a claim row without a known status is reported, not counted as verified", () => {
  const ledger = "| 1 | a | git log | VERIFIED |\n| 2 | b | note; owner to confirm |";
  assert.deepEqual(countLedgerClaims(ledger), {
    claims: 2,
    verified: 1,
    owner: 0,
    invalid: [2],
  });
});

test("owner-confirmed claims complete the fact check", () => {
  const base = {
    draft: false,
    pubDatetime: new Date("2026-11-01T06:30:00+07:00"),
    audience: "a",
    readerQuestions: ["q1", "q2", "q3"],
    readerCheck: { date: new Date("2026-11-01"), full: 3, total: 3 },
  };
  assert.deepEqual(
    postStandardViolations({
      ...base,
      factCheck: { date: new Date("2026-11-01"), claims: 32, verified: 31, owner: 1 },
    }),
    []
  );
  assert.deepEqual(
    postStandardViolations({
      ...base,
      factCheck: { date: new Date("2026-11-01"), claims: 32, verified: 31 },
    }),
    ["factCheck verified 31/32 claims; every claim must be"]
  );
});

test("ownerClaimsIn reads factCheck.owner of a published post", () => {
  const text = post(
    "factCheck:\n  date: 2026-10-30\n  claims: 32\n  verified: 31\n  owner: 1\n"
  );
  assert.equal(ownerClaimsIn(text), 1);
});

test("a draft or a post without owner claims needs no owner approval", () => {
  assert.equal(
    ownerClaimsIn(post("draft: true\nfactCheck:\n  claims: 3\n  verified: 2\n  owner: 1\n")),
    0
  );
  assert.equal(ownerClaimsIn(post("factCheck:\n  claims: 3\n  verified: 3\n")), 0);
});

const needs = [{ file: "src/content/posts/en/x.md", published: true, owner: 1 }];
const AGENT = "app/hclabs-agent";

test("owner claims and no review: blocked", () => {
  assert.match(
    ownerApprovalVerdict({ posts: needs, reviews: [], headSha: HEAD, owner: "hiimchinh", author: AGENT }) ?? "",
    /needs an approving review by hiimchinh/
  );
});

test("an approval by the agent App does not count", () => {
  const reviews = [{ login: "hclabs-agent[bot]", state: "APPROVED", commit: HEAD }];
  assert.notEqual(
    ownerApprovalVerdict({ posts: needs, reviews, headSha: HEAD, owner: "hiimchinh", author: AGENT }),
    null
  );
});

test("an owner approval of an older commit does not count", () => {
  const reviews = [{ login: "hiimchinh", state: "APPROVED", commit: OLD }];
  assert.notEqual(
    ownerApprovalVerdict({ posts: needs, reviews, headSha: HEAD, owner: "hiimchinh", author: AGENT }),
    null
  );
});

test("the owner's approval of the head commit passes", () => {
  const reviews = [{ login: "hiimchinh", state: "APPROVED", commit: HEAD }];
  assert.equal(
    ownerApprovalVerdict({ posts: needs, reviews, headSha: HEAD, owner: "hiimchinh", author: AGENT }),
    null
  );
});

test("a pull request that publishes no post passes without a review", () => {
  assert.equal(
    ownerApprovalVerdict({
      posts: [{ file: "src/content/posts/en/d.md", published: false, owner: 0 }],
      reviews: [],
      headSha: HEAD,
      owner: "hiimchinh",
      author: AGENT,
    }),
    null
  );
});

test("a published post without owner claims still needs the owner's approval", () => {
  assert.match(
    ownerApprovalVerdict({
      posts: [{ file: "src/content/posts/en/p.md", published: true, owner: 0 }],
      reviews: [],
      headSha: HEAD,
      owner: "hiimchinh",
      author: AGENT,
    }) ?? "",
    /needs an approving review by hiimchinh/
  );
});

test("a pull request the owner opened himself passes", () => {
  assert.equal(
    ownerApprovalVerdict({
      posts: needs,
      reviews: [],
      headSha: HEAD,
      owner: "hiimchinh",
      author: "hiimchinh",
    }),
    null
  );
});

test("publishesPost: a published post under the standard, not a draft or an old post", () => {
  assert.equal(publishesPost(post("")), true);
  assert.equal(publishesPost(post("draft: true\n")), false);
  assert.equal(
    publishesPost("---\ntitle: x\npubDatetime: 2026-10-01T06:30:00+07:00\n---\n"),
    false
  );
});
