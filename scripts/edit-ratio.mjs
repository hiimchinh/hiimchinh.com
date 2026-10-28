#!/usr/bin/env node
/* eslint-disable no-console -- CLI output is the point of this script. */
// How much of an agent draft the owner changed before publishing:
// (words deleted + words inserted) / words in the draft, on the prose only.
// Usage: node scripts/edit-ratio.mjs <draft.md> <published.md>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { stripNonProse } from "../src/utils/post-standards.ts";

function proseWords(text) {
  return stripNonProse(text)
    .split(/\s+/)
    .filter(Boolean);
}

function commonWords(a, b) {
  let prev = new Array(b.length + 1).fill(0);
  for (const word of a) {
    const row = [0];
    for (let j = 0; j < b.length; j++) {
      row.push(word === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], row[j]));
    }
    prev = row;
  }
  return prev[b.length];
}

export function editRatio(draft, published) {
  const a = proseWords(draft);
  const b = proseWords(published);
  if (a.length === 0) return b.length === 0 ? 0 : 1;
  const kept = commonWords(a, b);
  return (a.length - kept + (b.length - kept)) / a.length;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [draftPath, publishedPath] = process.argv.slice(2);
  if (!draftPath || !publishedPath) {
    console.error("usage: edit-ratio.mjs <draft.md> <published.md>");
    process.exit(2);
  }
  const ratio = editRatio(
    readFileSync(draftPath, "utf8"),
    readFileSync(publishedPath, "utf8")
  );
  console.log(ratio.toFixed(3));
}
