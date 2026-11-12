/**
 * Daily drafts live in the owner's Obsidian vault (second-brain repo,
 * `HC/blog-drafts/<slug>.md`). The agent leaves `> [!todo]` slots for the
 * opening and the opinion, which the owner writes himself, and
 * `> [!question]` callouts for claims only he can confirm. When he sets
 * `status: done`, scripts/vault-publish.sh turns the note into a post with
 * `draftToPost` and publishes it. The flow is in AGENTS.md ("Daily cadence").
 */

/** Frontmatter keys that belong to the vault note, never to the post. */
const VAULT_KEYS = ["status", "locale", "blocked", "url"];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const CALLOUT_START = /^>\s*\[!(\w+)\][-+]?\s*(.*)$/;

function key(line: string): string | undefined {
  return /^([A-Za-z][\w-]*):/.exec(line)?.[1];
}

function frontValue(front: string, name: string): string | undefined {
  const line = front.split(/\r?\n/).find(l => key(l) === name);
  return line
    ?.slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

/** The `status` of a vault draft: draft, done, blocked or published. */
export function draftStatus(text: string): string | undefined {
  const front = FRONTMATTER.exec(text)?.[1];
  return front === undefined ? undefined : frontValue(front, "status");
}

/** Whether a post was finished by the owner in Obsidian (`ownerDone`). */
export function ownerWrote(text: string): boolean {
  const front = FRONTMATTER.exec(text)?.[1] ?? "";
  return Boolean(frontValue(front, "ownerDone"));
}

/** The Vietnam-time ISO instant, e.g. 2026-11-13T09:05:00+07:00. */
function vietnamIso(now: Date): string {
  const shifted = new Date(now.getTime() + 7 * 3600 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, "+07:00");
}

type Callout = { type: string; title: string; start: number; end: number };

function callouts(lines: string[]): Callout[] {
  const found: Callout[] = [];
  for (let i = 0; i < lines.length; i++) {
    const head = CALLOUT_START.exec(lines[i]);
    if (!head) continue;
    let end = i + 1;
    while (end < lines.length && lines[end].startsWith(">")) end++;
    found.push({ type: head[1].toLowerCase(), title: head[2], start: i, end });
    i = end - 1;
  }
  return found;
}

export type DraftResult = {
  post: string;
  locale: string;
  /** Why the draft may not be published yet; empty when it may. */
  problems: string[];
};

/** Turns a vault draft the owner marked done into the post file to publish. */
export function draftToPost(text: string, now: Date): DraftResult {
  const match = FRONTMATTER.exec(text);
  if (!match)
    return { post: "", locale: "en", problems: ["thiếu frontmatter"] };

  const frontLines = match[1].split(/\r?\n/);
  const locale = frontValue(match[1], "locale") || "en";
  const kept = frontLines
    .filter(line => {
      const name = key(line);
      return !(name && (VAULT_KEYS.includes(name) || name === "draft"));
    })
    .map(line =>
      key(line) === "pubDatetime" ? `pubDatetime: ${vietnamIso(now)}` : line
    )
    .filter(line => key(line) !== "ownerDone");
  kept.push(`ownerDone: ${vietnamIso(now).slice(0, 10)}`);

  const lines = text.slice(match[0].length).split(/\r?\n/);
  const found = callouts(lines);
  const problems = found
    .filter(c => c.type === "todo")
    .map(c => `Chính chưa viết: ${c.title.replace(/^Chính viết:\s*/, "")}`);
  const drop = new Set<number>();
  for (const c of found.filter(c => c.type === "question")) {
    for (let i = c.start; i < c.end; i++) drop.add(i);
  }
  const body = lines
    .filter((_, i) => !drop.has(i))
    .join("\n")
    .replace(/<!--\s*DRAFT NOTES[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const post = ["---", ...kept, "---", "", body, ""].join("\n");
  return { post, locale, problems };
}

/**
 * Which note goes under a post: `ownerWrote` when the owner wrote the opening
 * and the opinion in Obsidian, `agentDrafted` for an agent draft he approved
 * (fact-checked posts), none for posts he wrote by hand.
 */
export function provenanceKey(post: {
  factCheck?: unknown;
  ownerDone?: Date;
}): "ownerWrote" | "agentDrafted" | undefined {
  if (post.ownerDone) return "ownerWrote";
  return post.factCheck ? "agentDrafted" : undefined;
}
