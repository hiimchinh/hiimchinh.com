import type { CollectionEntry } from "astro:content";
import { getAllPublishedPosts } from "./getLocalizedPosts";
import { getPostSlug } from "./getPostPaths";
import { availableLocales, localizePosts, type Locale } from "./locale-posts";

type AdjacentPost = {
  id: string;
  title: string;
  filePath: string | undefined;
} | null;

export type PostPageProps = {
  post: CollectionEntry<"posts">;
  prevPost: AdjacentPost;
  nextPost: AdjacentPost;
  /** The English original is shown because this locale has no translation. */
  isFallback: boolean;
  /** Locales that have their own copy of this post. */
  translations: Locale[];
};

const toAdjacent = (
  post: CollectionEntry<"posts"> | undefined
): AdjacentPost =>
  post
    ? { id: post.id, title: post.data.title, filePath: post.filePath }
    : null;

/** One route per post for a locale; newest first, so "previous" is older. */
export async function getPostStaticPaths(locale: Locale) {
  const all = await getAllPublishedPosts();
  const localized = localizePosts(all, locale);

  return localized.map(({ entry, slug, isFallback }, index) => ({
    params: { slug: getPostSlug(entry.id, entry.filePath) },
    props: {
      post: entry,
      prevPost: toAdjacent(localized[index + 1]?.entry),
      nextPost: toAdjacent(localized[index - 1]?.entry),
      isFallback,
      translations: availableLocales(all, slug),
    } satisfies PostPageProps,
  }));
}
