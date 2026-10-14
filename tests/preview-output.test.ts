import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Contract of a pull-request preview build, checked after
// `SITE_PREVIEW=true pnpm build`.
const OUT = new URL("../dist/", import.meta.url);

const htmlPages = (readdirSync(OUT, { recursive: true }) as string[]).filter(
  path => path.endsWith(".html")
);

test("the preview build has pages", () => {
  assert.ok(htmlPages.length > 0);
});

test("every page of a preview build is hidden from search engines", () => {
  const indexable = htmlPages.filter(
    path =>
      !/<meta name="robots" content="noindex, nofollow"/.test(
        readFileSync(new URL(path, OUT), "utf8")
      )
  );
  assert.deepEqual(indexable, []);
});
