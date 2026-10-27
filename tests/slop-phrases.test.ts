import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { slopHits } from "../src/utils/slop-phrases.ts";
import { WORD_LIMIT_SINCE } from "../src/utils/post-standards.ts";

test("stock AI phrases are found, case-insensitive, with the phrase named", () => {
  assert.deepEqual(
    slopHits("Let's dive in. This is a testament to robust design."),
    ["let's dive", "testament to"]
  );
});

test("plain technical prose has no hits", () => {
  assert.deepEqual(
    slopHits("The hook exits 2 and prints the safe command."),
    []
  );
});

test("code blocks and comments are not checked", () => {
  assert.deepEqual(
    slopHits("Text.\n```sh\necho delve into\n```\n<!-- delve -->"),
    []
  );
});

test("posts since the word limit use none of the stock AI phrases", async () => {
  const offenders: string[] = [];
  for (const locale of ["en", "vi"]) {
    const dir = new URL(`../src/content/posts/${locale}/`, import.meta.url);
    for (const name of await readdir(dir).catch(() => [])) {
      const text = await readFile(new URL(name, dir), "utf8");
      const pub = /^pubDatetime:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/m.exec(text)?.[1];
      if (!pub || new Date(pub) < WORD_LIMIT_SINCE) continue;
      const hits = slopHits(text);
      if (hits.length) offenders.push(`${locale}/${name}: ${hits.join(", ")}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("inline code and ordinary technical phrases are not slop", () => {
  assert.deepEqual(
    slopHits("Run `delve` to debug. In today's run the world of 3 tools held."),
    []
  );
});
