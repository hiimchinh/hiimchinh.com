import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

// Public copy must not identify the author's employer, past or present, nor
// name a customer without consent. Past work is framed by domain and years
// ("seven years at a cloud communications platform"), the same rule hclabs.co
// follows.
const NAMED = /\b(Stringee|StringeeX|Cogover|VIB|TPBank|HDBank|Hanwha Life|PTI|Be Finance|Hảo Đạt|Hao Dat|chehaodat)\b/i;

// A superlative turns a domain description into a unique identifier: there is
// exactly one "largest communications platform in Vietnam".
const SUPERLATIVE = /(lớn nhất (Việt Nam|VN)|(largest|leading|biggest)[^.\n]{0,40}(Vietnam|VN))/i;

async function collectFiles(dir: URL): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: URL[] = [];
  for (const entry of entries) {
    const child = new URL(entry.name, `${dir.href}/`);
    if (entry.isDirectory()) files.push(...(await collectFiles(child)));
    else if (/\.(astro|tsx?|jsx?|mdx?)$/.test(entry.name)) files.push(child);
  }
  return files;
}

async function offendersFor(pattern: RegExp) {
  const roots = [
    new URL("../src/", import.meta.url),
    new URL("../astro-paper.config.ts", import.meta.url),
  ];
  const files = [roots[1], ...(await collectFiles(roots[0]))];
  const offenders: string[] = [];
  for (const file of files) {
    if (pattern.test(await readFile(file, "utf8"))) {
      offenders.push(file.pathname.split("/hiimchinh.com/").at(-1)!);
    }
  }
  return offenders.sort();
}

test("public copy does not name an employer or a customer", async () => {
  assert.deepEqual(await offendersFor(NAMED), []);
});

test("public copy does not identify an employer by superlative", async () => {
  assert.deepEqual(await offendersFor(SUPERLATIVE), []);
});
