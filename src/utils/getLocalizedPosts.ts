import { getCollection, type CollectionEntry } from "astro:content";
import { getSortedPosts } from "./getSortedPosts";
import {
  DEFAULT_LOCALE,
  isLocale,
  localizePosts,
  type Locale,
} from "./locale-posts";

export function toLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Published posts for a locale, newest first. In Vietnamese, posts without a
 * translation appear as their English original.
 */
export async function getLocalizedPosts(
  locale: string | undefined
): Promise<CollectionEntry<"posts">[]> {
  const posts = getSortedPosts(await getCollection("posts"));
  return localizePosts(posts, toLocale(locale)).map(p => p.entry);
}

/** Every published post in every language, for routes that must exist per slug. */
export async function getAllPublishedPosts(): Promise<
  CollectionEntry<"posts">[]
> {
  return getSortedPosts(await getCollection("posts"));
}
