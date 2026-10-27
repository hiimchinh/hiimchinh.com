/**
 * Publishing standard for posts: every post names its reader, lists the
 * questions that reader brings, and passed an AI-reader check that answered
 * every question in full from the post's Markdown alone. The flow is in
 * AGENTS.md ("Writing a post"). Posts published before the standard existed
 * are exempt.
 */
export const STANDARD_SINCE = new Date("2026-10-14T00:00:00+07:00");
export const MIN_READER_QUESTIONS = 3;
/** Posts from this date also need every claim checked against its source. */
export const FACT_CHECK_SINCE = new Date("2026-10-28T00:00:00+07:00");
/** Owner requirement 27/10/2026: short and to the point. */
export const WORD_LIMIT_SINCE = FACT_CHECK_SINCE;
export const MAX_PROSE_WORDS = 600;

export type PostStandardFields = {
  draft?: boolean;
  pubDatetime: Date;
  audience?: string;
  readerQuestions?: string[];
  readerCheck?: { date: Date; full: number; total: number };
  factCheck?: { date: Date; claims: number; verified: number };
};

/** Human-readable reasons a post may not be published yet; empty when it may. */
export function postStandardViolations(post: PostStandardFields): string[] {
  if (post.draft || post.pubDatetime < STANDARD_SINCE) return [];

  const violations: string[] = [];
  const questions = post.readerQuestions ?? [];
  if (!post.audience?.trim()) violations.push("audience is missing");
  if (questions.length < MIN_READER_QUESTIONS) {
    violations.push(
      `readerQuestions needs at least ${MIN_READER_QUESTIONS} questions`
    );
  }

  const check = post.readerCheck;
  if (!check) {
    violations.push("readerCheck is missing");
  } else if (check.full < check.total) {
    violations.push(
      `readerCheck answered ${check.full}/${check.total} questions in full; every question must be`
    );
  } else if (check.total !== questions.length) {
    violations.push(
      `readerCheck covers ${check.total} questions but the post lists ${questions.length}`
    );
  }
  if (post.pubDatetime >= FACT_CHECK_SINCE) {
    violations.push(...factCheckViolations(post.factCheck));
  }
  return violations;
}

function factCheckViolations(check: PostStandardFields["factCheck"]): string[] {
  if (!check) return ["factCheck is missing"];
  if (check.claims < 1) return ["factCheck lists no claims"];
  if (check.verified < check.claims) {
    return [
      `factCheck verified ${check.verified}/${check.claims} claims; every claim must be`,
    ];
  }
  return [];
}

/** The prose of a post: no frontmatter, HTML comments or fenced code. */
export function stripNonProse(text: string): string {
  return text
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1[^\S\r\n]*$/gm, "");
}

/** Words a reader reads: no frontmatter, HTML comments or fenced code. */
export function proseWordCount(text: string): number {
  return stripNonProse(text)
    .split(/\s+/)
    .filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Notes for the author that must be removed before publishing. */
export function hasDraftNotes(text: string): boolean {
  return /DRAFT NOTES/.test(text);
}
