#!/usr/bin/env node
/* eslint-disable no-console -- CLI output is the point of this script. */
// Reads and converts the daily drafts in the owner's Obsidian vault
// (HC/blog-drafts/<slug>.md). Used by scripts/vault-publish.sh.
//   status <note>                      print the note's status
//   to-post <note> <repo>              write the post into <repo>, print its path;
//                                      exit 1 and print the problems if it may not publish
//   set-status <note> <status> [k=v…]  set the status and extra keys in the note
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { draftStatus, draftToPost } from "../src/utils/vault-draft.ts";

const [command, note, ...rest] = process.argv.slice(2);
const usage = "Usage: node scripts/vault-draft.mjs status|to-post|set-status <note> …";
if (!command || !note) {
  console.error(usage);
  process.exit(2);
}
const text = readFileSync(note, "utf8");

if (command === "status") {
  console.log(draftStatus(text) ?? "");
} else if (command === "to-post") {
  const { post, locale, problems } = draftToPost(text, new Date());
  if (problems.length) {
    console.log(problems.join("; "));
    process.exit(1);
  }
  const path = join("src/content/posts", locale, basename(note));
  writeFileSync(join(rest[0], path), post);
  console.log(path);
} else if (command === "set-status") {
  const [status, ...pairs] = rest;
  const values = { status, ...Object.fromEntries(pairs.map(p => p.split(/=(.*)/s, 2))) };
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) {
    console.error("The note has no frontmatter.");
    process.exit(1);
  }
  const lines = match[1].split(/\r?\n/).filter(l => !(l.split(":")[0] in values));
  const added = Object.entries(values).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  writeFileSync(note, text.replace(match[0], ["---", ...added, ...lines, "---"].join("\n")));
} else {
  console.error(usage);
  process.exit(2);
}
