/**
 * Claims only the owner can vouch for (his memory, a log on his own machine)
 * are counted in `factCheck.owner`. A pull request that publishes such a post
 * needs the owner's approving review on its head commit; CI enforces it with
 * scripts/owner-approval.mjs. The flow is in AGENTS.md ("Writing a post").
 */
import { FACT_CHECK_SINCE } from "./post-standards.ts";

export type LedgerCount = {
  claims: number;
  verified: number;
  owner: number;
  /** Claim numbers whose last cell is neither VERIFIED nor OWNER. */
  invalid: number[];
};

/** Counts the claim rows (`| <n> | … | <status> |`) of a private ledger. */
export function countLedgerClaims(ledger: string): LedgerCount {
  const count: LedgerCount = { claims: 0, verified: 0, owner: 0, invalid: [] };
  for (const line of ledger.split(/\r?\n/)) {
    const row = line.match(/^\|\s*(\d+)\s*\|(.*)\|\s*$/);
    if (!row) continue;
    count.claims++;
    const status = row[2].split("|").pop()?.trim();
    if (status === "VERIFIED") count.verified++;
    else if (status === "OWNER") count.owner++;
    else count.invalid.push(Number(row[1]));
  }
  return count;
}

function frontmatter(text: string): string {
  return text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
}

/** `factCheck.owner` of a published post under the fact-check standard, else 0. */
export function ownerClaimsIn(text: string): number {
  const fm = frontmatter(text);
  if (/^draft:\s*true\s*$/m.test(fm)) return 0;
  const published = fm.match(/^pubDatetime:\s*["']?([^"'\s]+)/m)?.[1];
  if (!published || new Date(published) < FACT_CHECK_SINCE) return 0;
  const block =
    fm.match(/^factCheck:\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m)?.[1] ?? "";
  return Number(block.match(/^\s+owner:\s*(\d+)/m)?.[1] ?? 0);
}

export type Review = { login: string; state: string; commit: string };

/** Why the pull request may not merge yet, or null when it may. */
export function ownerApprovalVerdict(input: {
  posts: { file: string; owner: number }[];
  reviews: Review[];
  headSha: string;
  owner: string;
}): string | null {
  const pending = input.posts.filter(post => post.owner > 0);
  if (pending.length === 0) return null;
  const approved = input.reviews.some(
    review =>
      review.login === input.owner &&
      review.state === "APPROVED" &&
      review.commit === input.headSha
  );
  if (approved) return null;
  const files = pending.map(p => `${p.file} (${p.owner})`).join(", ");
  return (
    `Owner-confirmed claims in ${files}: this pull request needs an approving ` +
    `review by ${input.owner} on commit ${input.headSha.slice(0, 7)}. After the ` +
    `owner confirms in chat, run: GITHUB_AS_OWNER=1 gh pr review <pr> --approve ` +
    `--body "<the owner's words>"`
  );
}
