/**
 * Stock phrases that mark text as machine-written filler. Taken from
 * Wikipedia's "Signs of AI writing" and kept short on purpose: each entry
 * must be wrong in a technical post, not merely common.
 */
export const SLOP_PHRASES = [
  "delve",
  "let's dive",
  "dive into",
  "testament to",
  "tapestry",
  "in today's",
  "fast-paced",
  "ever-evolving",
  "game-changer",
  "game changer",
  "it's worth noting",
  "it is worth noting",
  "in conclusion",
  "seamlessly",
  "unlock the",
  "unleash",
  "navigate the complexities",
  "the world of",
  "a crucial role",
  "plays a pivotal",
  "elevate your",
  "embark on",
] as const;

/** Phrases from SLOP_PHRASES found in prose, in order of first appearance. */
export function slopHits(text: string): string[] {
  const prose = text
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^```[\s\S]*?^```/gm, "")
    .toLowerCase()
    .replace(/[’]/g, "'");
  return SLOP_PHRASES.map(phrase => ({ phrase, at: prose.indexOf(phrase) }))
    .filter(hit => hit.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(hit => hit.phrase);
}
