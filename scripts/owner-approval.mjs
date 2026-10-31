#!/usr/bin/env node
/* eslint-disable no-console -- CLI output is the point of this script. */
// CI gate: a pull request that publishes a post with owner-confirmed claims
// (factCheck.owner > 0) needs the owner's approving review on its head commit.
// Env: PR, REPO (owner/name), HEAD_SHA, OWNER; GH_TOKEN for gh.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  ownerApprovalVerdict,
  ownerClaimsIn,
} from "../src/utils/owner-approval.ts";

const { PR, REPO, HEAD_SHA, OWNER } = process.env;
const gh = path =>
  JSON.parse(
    execFileSync("gh", ["api", "--paginate", "--slurp", path], {
      encoding: "utf8",
    })
  ).flat();

const posts = gh(`repos/${REPO}/pulls/${PR}/files`)
  .map(file => file.filename)
  .filter(name => /^src\/content\/posts\/.+\.mdx?$/.test(name))
  .filter(name => existsSync(name))
  .map(file => ({ file, owner: ownerClaimsIn(readFileSync(file, "utf8")) }));

const reviews = gh(`repos/${REPO}/pulls/${PR}/reviews`).map(review => ({
  login: review.user?.login ?? "",
  state: review.state,
  commit: review.commit_id,
}));

const reason = ownerApprovalVerdict({
  posts,
  reviews,
  headSha: HEAD_SHA,
  owner: OWNER,
});
if (reason) {
  console.error(reason);
  process.exit(1);
}
console.log(
  posts.some(post => post.owner > 0)
    ? `Owner approved commit ${HEAD_SHA.slice(0, 7)}.`
    : "No post with owner-confirmed claims."
);
