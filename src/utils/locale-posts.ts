/**
 * Locale handling for posts. A post lives under its language folder
 * (`src/content/posts/en/…`, `src/content/posts/vi/…`); the same relative path
 * in another folder is its translation. English is the primary language, so a
 * post outside any locale folder counts as English.
 *
 * Kept free of `astro:*` imports so it can be unit tested with `node --test`.
 */
export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

type Entry = { id: string };

export type LocalizedPost<T extends Entry> = {
  entry: T;
  /** Slug without the locale folder, shared by every translation. */
  slug: string;
  /** True when the entry is the English original shown in place of a missing translation. */
  isFallback: boolean;
};

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function splitLocale(id: string): { locale: Locale; slug: string } {
  const [first, ...rest] = id.split("/");
  if (isLocale(first) && rest.length > 0) {
    return { locale: first, slug: rest.join("/") };
  }
  return { locale: DEFAULT_LOCALE, slug: id };
}

/**
 * Posts to show for a locale, keeping the input order. English shows English
 * posts only. Another locale shows its translation when one exists, otherwise
 * the English original (flagged as fallback), plus posts written only in it.
 */
export function localizePosts<T extends Entry>(
  posts: T[],
  locale: Locale
): LocalizedPost<T>[] {
  const bySlug = new Map<string, Map<Locale, T>>();
  for (const entry of posts) {
    const { locale: entryLocale, slug } = splitLocale(entry.id);
    if (!bySlug.has(slug)) bySlug.set(slug, new Map());
    bySlug.get(slug)!.set(entryLocale, entry);
  }

  const result: LocalizedPost<T>[] = [];
  for (const [slug, versions] of bySlug) {
    const own = versions.get(locale);
    if (own) {
      result.push({ entry: own, slug, isFallback: false });
      continue;
    }
    const original = versions.get(DEFAULT_LOCALE);
    if (original && locale !== DEFAULT_LOCALE) {
      result.push({ entry: original, slug, isFallback: true });
    }
  }
  return result;
}

/** Locales that have their own copy of a slug, in `LOCALES` order. */
export function availableLocales<T extends Entry>(
  posts: T[],
  slug: string
): Locale[] {
  const present = new Set(
    posts
      .map(p => splitLocale(p.id))
      .filter(p => p.slug === slug)
      .map(p => p.locale)
  );
  return LOCALES.filter(l => present.has(l));
}
