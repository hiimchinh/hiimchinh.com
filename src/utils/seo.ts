/**
 * Indexing rules shared by pages and the sitemap.
 *
 * Kept free of `astro:*` imports so it can be unit tested with `node --test`
 * and imported from `astro.config.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const NOINDEX_FOLLOW = "noindex, follow";

/** A tag page needs at least this many posts before it is worth indexing. */
export const MIN_POSTS_PER_INDEXED_TAG = 2;

/**
 * Robots directive for a paginated listing. Later pages and tag pages with
 * too few posts add nothing a search result needs, but their links still count.
 */
export function listingRobots({
  currentPage,
  tagPostCount,
}: {
  currentPage: number;
  tagPostCount?: number;
}): string | undefined {
  if (currentPage > 1) return NOINDEX_FOLLOW;
  if (tagPostCount !== undefined && tagPostCount < MIN_POSTS_PER_INDEXED_TAG) {
    return NOINDEX_FOLLOW;
  }
  return undefined;
}

/** True when built HTML neither opts out of indexing nor defers to another URL. */
export function isIndexableHtml(html: string, url: string): boolean {
  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
  if (robots && /\bnoindex\b/i.test(robots)) return false;
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  return canonical === undefined || canonical === url;
}

function builtHtmlPath(outDir: string, url: string): string | undefined {
  const pathname = decodeURIComponent(new URL(url).pathname);
  const candidates = pathname.endsWith("/")
    ? [
        join(outDir, pathname, "index.html"),
        join(outDir, `${pathname.slice(0, -1)}.html`),
      ]
    : [join(outDir, pathname)];
  return candidates.find(existsSync);
}

/**
 * Sitemap filter that reads each page's built HTML: a page that is noindex or
 * canonical to another URL stays out of the sitemap. The sitemap integration
 * runs after every page is written, so the HTML is the source of truth.
 */
export function createSitemapFilter(outDir: string): (url: string) => boolean {
  return url => {
    const file = builtHtmlPath(outDir, url);
    if (!file || !file.endsWith(".html")) return true;
    return isIndexableHtml(readFileSync(file, "utf8"), url);
  };
}
