import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// Contract of the built site, checked after `pnpm build`.
const OUT = new URL("../dist/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, OUT), "utf8");
const exists = (path: string) => existsSync(new URL(path, OUT));

const OLD_POST = "/2021/05/translate_file_permissions_linux/";
const NEW_POST = "/posts/translate-file-permissions-linux/";

test("the 2021 post is published at its new URL", () => {
  assert.ok(exists("posts/translate-file-permissions-linux/index.html"));
});

test("every URL of the Hugo site redirects permanently to its new home", () => {
  const rules = read("_redirects")
    .split("\n")
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts.length === 3);
  const target = (from: string) => rules.find(([source]) => source === from);
  assert.deepEqual(target(OLD_POST), [OLD_POST, NEW_POST, "301"]);
  assert.deepEqual(target("/post/"), ["/post/", "/posts/", "301"]);
  assert.deepEqual(target("/index.xml"), ["/index.xml", "/rss.xml", "301"]);
  assert.deepEqual(target("/contact/"), ["/contact/", "/about/#contact", "301"]);
});

test("the Vietnamese about page renders the Vietnamese copy", () => {
  assert.match(read("vi/about/index.html"), /Chào bạn, mình là Chính/);
});

test("an untranslated post under /vi/ says so and defers to the English URL", () => {
  const html = read("vi/posts/translate-file-permissions-linux/index.html");
  assert.match(html, /Bài này hiện chỉ có bản tiếng Anh\./);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/hiimchinh\.com\/posts\/translate-file-permissions-linux\/?"/
  );
});

test("pages declare both languages with hreflang", () => {
  const html = read("index.html");
  assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/hiimchinh\.com\/"/);
  assert.match(html, /<link rel="alternate" hreflang="vi" href="https:\/\/hiimchinh\.com\/vi\/"/);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/hiimchinh\.com\/"/);
});

test("each post has a raw Markdown copy for agents", () => {
  const md = read("posts/translate-file-permissions-linux.md");
  assert.match(md, /^# File Permissions in Linux\/Unix: How to translate them\?/);
  assert.match(md, /- 4: read/);
});

test("llms.txt indexes the site for agents", () => {
  const txt = read("llms.txt");
  assert.match(txt, /^# Chinh Hoang\n/);
  assert.match(
    txt,
    /\[File Permissions in Linux\/Unix: How to translate them\?\]\(https:\/\/hiimchinh\.com\/posts\/translate-file-permissions-linux\.md\)/
  );
  assert.match(txt, /## Projects/);
  assert.match(read("llms-full.txt"), /- 4: read/);
});

test("the home page describes the author as a Person in JSON-LD", () => {
  assert.match(read("index.html"), /"@type":"Person","name":"Chinh Hoang"/);
});

test("each post offers copy-for-LLM and open-in-chat actions", () => {
  const html = read("posts/translate-file-permissions-linux/index.html");
  assert.match(html, /data-copy-markdown="\/posts\/translate-file-permissions-linux\.md"/);
  assert.match(html, /href="https:\/\/chatgpt\.com\/\?q=Read%20https%3A%2F%2Fhiimchinh\.com%2Fposts%2Ftranslate-file-permissions-linux\.md/);
  assert.match(html, /href="https:\/\/claude\.ai\/new\?q=Read%20https%3A%2F%2Fhiimchinh\.com/);
});

const SITE = "https://hiimchinh.com";
const canonicalOf = (html: string) =>
  html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
const hreflangsOf = (html: string) =>
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map(
    ([, lang, href]) => [lang, href]
  );
const descriptionOf = (html: string) =>
  html.match(/<meta name="description" content="([^"]*)"/)?.[1];
const robotsOf = (html: string) =>
  html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
const sitemapUrls = () =>
  [...read("sitemap-0.xml").matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]);

test("Vietnamese pages with Vietnamese content are their own canonical", () => {
  for (const path of ["/vi/", "/vi/about/", "/vi/posts/", "/vi/tags/", "/vi/archives/", "/vi/projects/"]) {
    const html = read(`${path.slice(1)}index.html`);
    assert.equal(canonicalOf(html), `${SITE}${path}`, path);
    assert.equal(robotsOf(html), undefined, path);
  }
});

test("the Vietnamese about page pairs with the English one through hreflang", () => {
  assert.deepEqual(hreflangsOf(read("vi/about/index.html")), [
    ["en", `${SITE}/about/`],
    ["vi", `${SITE}/vi/about/`],
    ["x-default", `${SITE}/about/`],
  ]);
});

test("a post without a translation declares no Vietnamese alternate", () => {
  const vi = read("vi/posts/translate-file-permissions-linux/index.html");
  assert.equal(canonicalOf(vi), `${SITE}${NEW_POST}`);
  assert.deepEqual(hreflangsOf(vi), []);
  const en = read("posts/translate-file-permissions-linux/index.html");
  assert.equal(canonicalOf(en), `${SITE}${NEW_POST}`);
  assert.ok(!hreflangsOf(en).some(([lang]) => lang === "vi"));
});

test("the sitemap lists only indexable, self-canonical pages", () => {
  const urls = sitemapUrls();
  for (const url of [`${SITE}/`, `${SITE}/vi/`, `${SITE}/about/`, `${SITE}/vi/about/`, `${SITE}${NEW_POST}`]) {
    assert.ok(urls.includes(url), `missing ${url}`);
  }
  for (const url of [
    `${SITE}/vi/404/`,
    `${SITE}/search/`,
    `${SITE}/vi/search/`,
    `${SITE}/vi${NEW_POST}`,
    `${SITE}/tags/linux/`,
  ]) {
    assert.ok(!urls.includes(url), `unexpected ${url}`);
  }
});

test("search and 404 pages are noindex", () => {
  for (const path of ["search/index.html", "vi/search/index.html", "404.html", "vi/404/index.html"]) {
    assert.match(robotsOf(read(path)) ?? "", /noindex/, path);
  }
});

test("a tag page with a single post is noindex, follow", () => {
  assert.equal(robotsOf(read("tags/linux/index.html")), "noindex, follow");
  assert.equal(robotsOf(read("vi/tags/linux/index.html")), "noindex, follow");
});

test("listing pages have distinct meta descriptions in both languages", () => {
  const listings = ["", "posts/", "tags/", "tags/linux/", "archives/", "projects/", "search/"];
  const paths = [...listings, ...listings.map(p => `vi/${p}`)];
  const descriptions = paths.map(p => descriptionOf(read(`${p}index.html`)));
  descriptions.forEach((d, i) => assert.ok(d, `no description on /${paths[i]}`));
  assert.equal(new Set(descriptions).size, paths.length, descriptions.join("\n"));
});

test("RSS autodiscovery points at the feed that exists", () => {
  for (const path of ["index.html", "vi/index.html", "vi/about/index.html"]) {
    const href = read(path).match(/<link rel="alternate" type="application\/rss\+xml"[^>]*href="([^"]*)"/)?.[1];
    assert.equal(href, `${SITE}/rss.xml`, path);
  }
  assert.ok(exists("rss.xml"));
});

test("Vietnamese project cards are written in Vietnamese", () => {
  const html = read("vi/projects/index.html");
  assert.match(html, /2019 – nay/);
  assert.doesNotMatch(html, /A low-code platform|2024 – now/);
});

test("social link labels follow the page language", () => {
  const vi = read("vi/index.html");
  assert.match(vi, /Chinh Hoang trên X/);
  assert.match(vi, /Gửi email cho Chinh Hoang/);
  assert.doesNotMatch(vi, /Chinh Hoang on X|Send an email to/);
  assert.match(read("index.html"), /Chinh Hoang on X/);
});

test("the Vietnamese copy says where Chinh works, not that he builds the products", () => {
  assert.match(descriptionOf(read("vi/index.html")) ?? "", /làm việc tại Stringee và Cogover/);
  assert.match(descriptionOf(read("vi/about/index.html")) ?? "", /làm việc tại Stringee và Cogover/);
});

test("a post with two or more sections lists them in the contents", () => {
  const html = read("posts/translate-file-permissions-linux/index.html");
  assert.match(html, /data-toc-link="the-four-numbers"/);
  assert.match(html, /data-toc-link="adding-them-up"/);
});
