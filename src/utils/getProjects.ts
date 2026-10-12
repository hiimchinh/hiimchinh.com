import { getCollection, type CollectionEntry } from "astro:content";
import { toLocale } from "./getLocalizedPosts";
import { localizePosts } from "./locale-posts";

/** Projects for a locale (translation when present), in their `order`. */
export async function getProjects(
  locale: string | undefined
): Promise<CollectionEntry<"projects">[]> {
  const projects = await getCollection("projects");
  return localizePosts(projects, toLocale(locale))
    .map(({ entry }) => entry)
    .sort((a, b) => a.data.order - b.data.order);
}
