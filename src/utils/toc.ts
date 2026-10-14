interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocEntry {
  slug: string;
  text: string;
  sub: boolean;
}

/** A contents rail only helps when there is somewhere to jump to. */
export const TOC_MIN_SECTIONS = 2;

/** Slug of the collapsible inline list that remark-toc fills in (astro.config.ts). */
const INLINE_TOC_SLUG = "table-of-contents";

/** h2 = sections, h3 = sub-steps; an h3 before the first h2 has no parent. */
export function tocEntries(headings: Heading[]): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const { depth, slug, text } of headings) {
    if (slug === INLINE_TOC_SLUG) continue;
    if (depth === 2) entries.push({ slug, text, sub: false });
    else if (depth === 3 && entries.length > 0)
      entries.push({ slug, text, sub: true });
  }
  const sections = entries.filter(e => !e.sub).length;
  return sections >= TOC_MIN_SECTIONS ? entries : [];
}
