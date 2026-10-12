import type { CollectionEntry } from "astro:content";
import config from "@/config";
import { getPostUrl } from "./getPostPaths";

/** Absolute URL of a post's raw Markdown copy (`/posts/<slug>.md`). */
export function postMarkdownUrl(post: CollectionEntry<"posts">): string {
  const path = getPostUrl(post.id, post.filePath, "en").replace(/\/+$/, "");
  return new URL(`${path}.md`, config.site.url).href;
}

/** A post as plain Markdown for agents: title, summary, date, then the source body. */
export function postToMarkdown(post: CollectionEntry<"posts">): string {
  const { title, description, pubDatetime, modDatetime } = post.data;
  const url = new URL(getPostUrl(post.id, post.filePath, "en"), config.site.url)
    .href;
  const updated = modDatetime
    ? `\nUpdated: ${modDatetime.toISOString().slice(0, 10)}`
    : "";
  return [
    `# ${title}`,
    "",
    `> ${description}`,
    "",
    `Published: ${pubDatetime.toISOString().slice(0, 10)}${updated}`,
    `Author: ${post.data.author}`,
    `Source: ${url}`,
    "",
    (post.body ?? "").trim(),
    "",
  ].join("\n");
}
