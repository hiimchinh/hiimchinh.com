import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createSitemapFilter,
  isIndexableHtml,
  listingRobots,
} from "../src/utils/seo.ts";

const page = (canonical: string, robots?: string) =>
  `<html><head><link rel="canonical" href="${canonical}">${
    robots ? `<meta name="robots" content="${robots}">` : ""
  }</head></html>`;

test("a self-canonical page without robots meta is indexable", () => {
  const url = "https://hiimchinh.com/vi/about/";
  assert.equal(isIndexableHtml(page(url), url), true);
});

test("a page whose canonical points elsewhere is not indexable", () => {
  assert.equal(
    isIndexableHtml(
      page("https://hiimchinh.com/posts/a/"),
      "https://hiimchinh.com/vi/posts/a/"
    ),
    false
  );
});

test("a noindex page is not indexable", () => {
  const url = "https://hiimchinh.com/search/";
  assert.equal(isIndexableHtml(page(url, "noindex, follow"), url), false);
});

test("listing pages beyond the first are noindex, follow", () => {
  assert.equal(listingRobots({ currentPage: 1 }), undefined);
  assert.equal(listingRobots({ currentPage: 2 }), "noindex, follow");
});

test("a tag page with fewer than two posts is noindex, follow", () => {
  assert.equal(
    listingRobots({ currentPage: 1, tagPostCount: 1 }),
    "noindex, follow"
  );
  assert.equal(listingRobots({ currentPage: 1, tagPostCount: 2 }), undefined);
});

test("the sitemap filter reads built HTML and keeps only indexable pages", () => {
  const out = mkdtempSync(join(tmpdir(), "sitemap-filter-"));
  const write = (path: string, html: string) => {
    mkdirSync(join(out, path, ".."), { recursive: true });
    writeFileSync(join(out, path), html);
  };
  write("vi/about/index.html", page("https://hiimchinh.com/vi/about/"));
  write(
    "vi/posts/a/index.html",
    page("https://hiimchinh.com/posts/a/")
  );
  write(
    "vi/404/index.html",
    page("https://hiimchinh.com/vi/404/", "noindex")
  );
  const keep = createSitemapFilter(out);
  assert.equal(keep("https://hiimchinh.com/vi/about/"), true);
  assert.equal(keep("https://hiimchinh.com/vi/posts/a/"), false);
  assert.equal(keep("https://hiimchinh.com/vi/404/"), false);
  // A URL without a built HTML file is left to the default behaviour.
  assert.equal(keep("https://hiimchinh.com/rss.xml"), true);
});
