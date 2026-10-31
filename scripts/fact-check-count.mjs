#!/usr/bin/env node
/* eslint-disable no-console -- CLI output is the point of this script. */
// Counts the claims of a private ledger and, given a post, writes its
// factCheck block, so the numbers come from the ledger and not by hand.
// Usage: node scripts/fact-check-count.mjs <ledger.md> [post.md]
import { readFileSync, writeFileSync } from "node:fs";
import { countLedgerClaims } from "../src/utils/owner-approval.ts";

const [ledgerPath, postPath] = process.argv.slice(2);
if (!ledgerPath) {
  console.error("Usage: node scripts/fact-check-count.mjs <ledger.md> [post.md]");
  process.exit(2);
}
const count = countLedgerClaims(readFileSync(ledgerPath, "utf8"));
if (count.invalid.length) {
  console.error(
    `Claims ${count.invalid.join(", ")} need a last cell of VERIFIED or OWNER.`
  );
  process.exit(1);
}
const date = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
});
const lines = [
  "factCheck:",
  `  date: ${date}`,
  `  claims: ${count.claims}`,
  `  verified: ${count.verified}`,
  ...(count.owner ? [`  owner: ${count.owner}`] : []),
];
console.log(lines.join("\n"));
if (postPath) {
  const text = readFileSync(postPath, "utf8");
  const block = /^factCheck:\s*\r?\n(?:[ \t]+.*\r?\n)*/m;
  const replacement = lines.join("\n") + "\n";
  const updated = block.test(text)
    ? text.replace(block, replacement)
    : text.replace(/^(---\r?\n[\s\S]*?)(\r?\n---)/, `$1\n${lines.join("\n")}$2`);
  writeFileSync(postPath, updated);
}
