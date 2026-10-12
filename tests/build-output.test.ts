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
  assert.match(md, /^# File Permisisons in Linux\/Unix: How to translate them\?/);
  assert.match(md, /- 4: read/);
});

test("llms.txt indexes the site for agents", () => {
  const txt = read("llms.txt");
  assert.match(txt, /^# Chinh Hoang\n/);
  assert.match(
    txt,
    /\[File Permisisons in Linux\/Unix: How to translate them\?\]\(https:\/\/hiimchinh\.com\/posts\/translate-file-permissions-linux\.md\)/
  );
  assert.match(txt, /## Projects/);
  assert.match(read("llms-full.txt"), /- 4: read/);
});

test("the home page describes the author as a Person in JSON-LD", () => {
  assert.match(read("index.html"), /"@type":"Person","name":"Chinh Hoang"/);
});
