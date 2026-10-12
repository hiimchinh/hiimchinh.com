import assert from "node:assert/strict";
import test from "node:test";
import {
  availableLocales,
  localizePosts,
  splitLocale,
} from "../src/utils/locale-posts.ts";

const post = (id: string) => ({ id, data: { draft: false } });

test("splitLocale reads the locale folder and keeps the rest as slug", () => {
  assert.deepEqual(splitLocale("en/translate-file-permissions-linux"), {
    locale: "en",
    slug: "translate-file-permissions-linux",
  });
  assert.deepEqual(splitLocale("vi/notes/first-note"), {
    locale: "vi",
    slug: "notes/first-note",
  });
});

test("splitLocale treats a post outside a locale folder as English", () => {
  assert.deepEqual(splitLocale("hello-world"), {
    locale: "en",
    slug: "hello-world",
  });
});

test("English listing holds only English posts", () => {
  const posts = [post("en/a"), post("vi/a"), post("vi/only-vi")];
  const result = localizePosts(posts, "en");
  assert.deepEqual(
    result.map(p => [p.entry.id, p.slug, p.isFallback]),
    [["en/a", "a", false]]
  );
});

test("Vietnamese listing prefers the translation and falls back to English", () => {
  const posts = [
    post("en/a"),
    post("en/b"),
    post("vi/a"),
    post("vi/only-vi"),
  ];
  const result = localizePosts(posts, "vi");
  assert.deepEqual(
    result.map(p => [p.entry.id, p.slug, p.isFallback]),
    [
      ["vi/a", "a", false],
      ["en/b", "b", true],
      ["vi/only-vi", "only-vi", false],
    ]
  );
});

test("availableLocales lists every locale that has its own copy of a slug", () => {
  const posts = [post("en/a"), post("vi/a"), post("en/b")];
  assert.deepEqual(availableLocales(posts, "a"), ["en", "vi"]);
  assert.deepEqual(availableLocales(posts, "b"), ["en"]);
});
