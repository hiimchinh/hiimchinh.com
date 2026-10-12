#!/usr/bin/env node
/* eslint-disable no-console -- CLI output is the point of this script. */
// Create a post: `pnpm new-post "Post title" [--vi]`.
// English posts go to src/content/posts/en/, Vietnamese ones to .../vi/.
// A translation must use the same file name as its English original.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const locale = args.includes("--vi") ? "vi" : "en";
const title = args.filter(arg => arg !== "--vi").join(" ").trim();

if (!title) {
  console.error('Usage: pnpm new-post "Post title" [--vi]');
  process.exit(1);
}

const slug = title
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/đ/gi, "d")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const file = `src/content/posts/${locale}/${slug}.md`;

if (existsSync(file)) {
  console.error(`${file} already exists`);
  process.exit(1);
}

const now = new Date().toISOString();
mkdirSync(dirname(file), { recursive: true });
writeFileSync(
  file,
  `---
title: ${JSON.stringify(title)}
description: ""
pubDatetime: ${now}
tags: []
draft: true
---

`
);
console.log(file);
