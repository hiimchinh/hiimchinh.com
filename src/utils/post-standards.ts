/**
 * Publishing standard for posts: every post names its reader, lists the
 * questions that reader brings, and passed an AI-reader check that answered
 * every question in full from the post's Markdown alone. The flow is in
 * AGENTS.md ("Writing a post"). Posts published before the standard existed
 * are exempt.
 */
export const STANDARD_SINCE = new Date("2026-10-14T00:00:00+07:00");
export const MIN_READER_QUESTIONS = 3;

export type PostStandardFields = {
  draft?: boolean;
  pubDatetime: Date;
  audience?: string;
  readerQuestions?: string[];
  readerCheck?: { date: Date; full: number; total: number };
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
  return violations;
}

/** Notes for the author that must be removed before publishing. */
export function hasDraftNotes(text: string): boolean {
  return /DRAFT NOTES/.test(text);
}
