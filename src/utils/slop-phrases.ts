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
  // Added 09/11/2026 from Wikipedia "Signs of AI writing" and Pangram's
  // comparison of model and human prose.
  "serves as",
  "stands as",
  ", highlighting",
  ", underscoring",
  ", showcasing",
  "crucial to note",
  "quietly",
  "fundamentally",
  "remarkably",
  "arguably",
  "multifaceted",
  "foster",
  "pivotal",
  "in conclusion",
  "here's the thing",
] as const;

/** Sentence frames models overuse; each label names the frame. */
const SLOP_FRAMES: { label: string; pattern: RegExp }[] = [
  {
    label: "it's not X, it's Y",
    pattern:
      /\b(?:it|this|that)(?:'s| is) not [^.;!?\n]{1,60}[,;—-]\s*(?:it|this|that)(?:'s| is)\b/,
  },
  {
    label: "not just X, but Y",
    pattern: /\bnot (?:just|only|merely) [^.;!?\n]{1,60}?,? but\b/,
  },
];

/** At most one em dash per post; models use them about 8 times as often. */
const MAX_EM_DASHES = 1;

/** Slop phrases and frames found in prose, in order of first appearance. */
export function slopHits(text: string): string[] {
  const prose = stripNonProse(text)
    .replace(/`[^`\n]*`/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'");
  const hits = [
    ...SLOP_PHRASES.map(phrase => ({ phrase, at: prose.indexOf(phrase) })),
    ...SLOP_FRAMES.map(({ label, pattern }) => ({
      phrase: label,
      at: prose.search(pattern),
    })),
  ]
    .filter(hit => hit.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(hit => hit.phrase);
  const dashes = prose.split("—").length - 1;
  if (dashes > MAX_EM_DASHES) hits.push(`em dash x${dashes}`);
  return hits;
}
