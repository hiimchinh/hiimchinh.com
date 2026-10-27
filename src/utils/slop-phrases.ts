import { stripNonProse } from "./post-standards.ts";

/**
 * Stock phrases that mark text as machine-written filler. Taken from
 * Wikipedia's "Signs of AI writing" and kept short on purpose: each entry
 * must be wrong in a technical post, not merely common.
 */
export const SLOP_PHRASES = [
  "delve",
  "let's dive",
  "testament to",
  "tapestry",
  "fast-paced",
  "ever-evolving",
  "game-changer",
  "game changer",
  "it's worth noting",
  "it is worth noting",
  "seamlessly",
  "unleash",
  "navigate the complexities",
  "plays a pivotal",
  "elevate your",
  "embark on",
] as const;

/** Phrases from SLOP_PHRASES found in prose, in order of first appearance. */
export function slopHits(text: string): string[] {
  const prose = stripNonProse(text)
    .replace(/`[^`\n]*`/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'");
  return SLOP_PHRASES.map(phrase => ({ phrase, at: prose.indexOf(phrase) }))
    .filter(hit => hit.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(hit => hit.phrase);
}
