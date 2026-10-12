import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

// The site presents Chinh's work at Stringee and Cogover only. It must not name
// his own companies or side products, nor any customer.
const NAMED =
  /\b(HC ?Labs|hclabs|Portside|1Mạch|1Mach|Rinh|VIB|TPBank|HDBank|Hanwha Life|PTI|Be Finance|Hảo Đạt|Hao Dat|chehaodat)\b/i;

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

test("public copy does not name own companies, side products or customers", async () => {
  assert.deepEqual(await offendersFor(NAMED), []);
});
