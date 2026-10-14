import type { CollectionEntry } from "astro:content";
import { SITE_PREVIEW } from "astro:env/server";
import config from "@/config";
import { isPostVisible } from "./post-visibility";

/**
 * Determines whether a post is eligible to be listed/rendered.
 * Rules live in `isPostVisible()`; this binds them to the current build.
 */
export function postFilter({ data }: CollectionEntry<"posts">) {
  return isPostVisible(data, {
    now: Date.now(),
    scheduledMargin: config.posts.scheduledPostMargin,
    dev: import.meta.env.DEV,
    preview: SITE_PREVIEW,
  });
}
