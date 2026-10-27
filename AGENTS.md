# hiimchinh.com — agent guide

Personal site of Chinh Hoang: a blog and a portfolio. Astro 7 on the AstroPaper
theme, deployed as static assets to Cloudflare Workers.

## Commands

| Task | Command |
|---|---|
| Install | `corepack pnpm install --frozen-lockfile` |
| Dev server | `pnpm dev` |
| New post | `pnpm new-post "Title"` (add `--vi` for a Vietnamese post) |
| Unit tests | `pnpm test` |
| Build | `pnpm build` (runs `astro check`, builds, indexes search) |
| Build contract | `pnpm test:build` (after `pnpm build`) |
| Lint / format | `pnpm lint`, `pnpm format` |

pnpm comes from `packageManager` in `package.json` through corepack. Never install
another pnpm globally and never commit a lockfile written by another version.

## Content

- Posts: `src/content/posts/en/<slug>.md`. English is the primary language.
- A Vietnamese translation uses the same file name under `src/content/posts/vi/`.
  Without one, `/vi/posts/<slug>/` shows the English post with a notice and a
  canonical link to the English URL.
- A post written only in Vietnamese lives only in `vi/` and is listed only under `/vi/`.
- Projects (portfolio): `src/content/projects/en/<slug>.md`, sorted by `order`.
  The Vietnamese card uses the same file name under `src/content/projects/vi/`.
- About page: `src/content/pages/{en,vi}/about.md`. Home hero: `src/data/home.ts`.
- UI strings: `src/i18n/lang/{en,vi}.ts`. Add a key to `src/i18n/types.ts` first.
- Frontmatter is validated by `src/content.config.ts`; a wrong field fails the build.
- New posts start with `draft: true`. Remove it to publish.

## Writing a post

Every post since 14 October 2026 follows this flow. The build fails on a
published post that skips it (`src/utils/post-standards.ts`, checked in the
content schema and `tests/post-standards.test.ts`).

Ideas come from the private inbox `hiimchinh/blog-ideas` (editor at
`/admin/ideas/`). Its `AGENTS.md` holds the ranking rubric; pick the highest
`priority` with `status: next`, and set the idea's `post` and `status` as the
post moves.

1. **Pick one reader.** Write `audience` in one line, e.g. "Developers with a
   static site on Netlify who want to move it to Cloudflare Workers".
2. **List their questions.** At least 3 in `readerQuestions`, phrased as that
   reader would ask an AI assistant. Include one "does this apply to me?" and
   one "how do I check it worked?".
3. **Write the draft** in the online editor at `/admin/` (Sveltia CMS,
   `public/admin/config.yml`; saving opens the PR of step 4 on branch
   `cms/posts/<slug>`) or with `pnpm new-post "Title"`. It stays
   `draft: true`. Style:
   task-shaped title ("How to …"), a description that states the result, a
   "Does this guide apply to you?" section (what does not carry over), numbered
   steps with real commands, and expected output for each check. Facts come
   from the owner or from verified sources; never invent numbers. Notes for the
   owner go in an HTML comment starting with `DRAFT NOTES`.
4. **Open a PR.** CI comments a preview link where the draft is visible.
5. **Run the AI-reader check.** Spawn a fresh subagent (a small model is
   enough) whose only source is the preview Markdown,
   `https://pr-<n>-hiimchinh-com.ch-nh.workers.dev/posts/<slug>.md`. It answers
   each `readerQuestions` entry and grades it FULL (a quoted sentence answers
   the whole question), PARTIAL or NONE. Fix the post and re-run with a new
   subagent until every question is FULL.
6. **Record the result** in `readerCheck` (`date`, `full`, `total`).
7. **Publish** after the owner approves: remove `draft: true` and the
   `DRAFT NOTES` comment, merge.

## Daily cadence: the agent writes, the owner approves

Owner decision 27 October 2026: one post a day, written by an agent and
reviewed and edited by the owner. The owner's review time is the binding
constraint, so every draft must reach the owner ready to publish. A scheduled
job runs the steps below every morning (06:30 Asia/Ho_Chi_Minh).

1. **Publish what the owner approved.** An open post PR is approved when the
   owner approved it on GitHub, moved it to "Ready" in `/admin/` (label
   `sveltia-cms/pending_publish`), or said so in chat. Remove `draft: true` and
   the `DRAFT NOTES` comment. If the owner changed the text after the last
   `readerCheck`, run the AI-reader check again. Merge when CI is green. Set
   the idea to `status: published`.
2. **Apply the owner's comments** on the other open post PRs, then re-run the
   AI-reader check.
3. **Harvest ideas.** Read the second-brain notes added or changed in the last
   day under `HC/incidents`, `HC/knowledge` and `HC/runbooks`. Add an idea to
   `hiimchinh/blog-ideas` only when it fits an approved series and passes the
   Non-negotiables. Lessons from client work are `client-only`. Business,
   money, contract and customer notes are never ideas.
4. **Stop if the owner is behind.** When 2 or more post PRs wait for the
   owner, write nothing new. The report says which drafts wait.
5. **Write one post** from the highest-priority idea, following "Writing a
   post". Shape: one task, 400–900 words, real commands and real output, a
   mistake or a surprise from the owner's own work. Open the PR from branch
   `cms/posts/<slug>` with label `sveltia-cms/pending_review`, so the draft also
   appears in `/admin/` for editing in the browser.
6. **Report** in Vietnamese, at most 120 words: the preview link of each draft
   that waits, the claims the owner must confirm, what was published.

Rules for daily drafts:

- The repository, its PRs and the preview link are public. `DRAFT NOTES` lists
  the claims to confirm, never a private note path, a host name of the owner's
  servers, a customer or a company name. Sources go in the idea's `sources`
  field in the private inbox.
- Write in English. A Vietnamese translation is not part of the daily job.
- Never invent a number, an output or an experience. When the notes do not
  have the real output, reproduce it in a throwaway container or drop the
  idea for that day.
- Weekly, on Sunday, also report: posts published in the last 7 days, open
  drafts, days each draft waited, and Search Console clicks and impressions
  when that access works.

## Non-negotiables

1. **Work shown here is Stringee and Cogover only.** Never name Chinh's own
   companies or side products (HC Labs, Portside, …) or any customer. Chinh has
   a confidentiality duty to Stringee: describe only what the products say
   publicly and his own role. No internal numbers, internal systems, customer
   projects or unreleased features. `tests/restricted-references.test.ts`
   enforces the names.
2. **No invented facts.** Achievements, numbers and project details come from the
   owner. Ask when unsure.
3. **Keep old URLs working.** Every moved URL gets a 301 in `public/_redirects`
   and a case in `tests/build-output.test.ts`.
4. **Agent-readable output stays:** `/llms.txt`, `/llms-full.txt`, and a raw
   Markdown copy of each post at `/posts/<slug>.md`.
5. Behaviour changes are test-first: unit tests in `tests/*.test.ts` for logic,
   `tests/build-output.test.ts` for what the built site must contain.

## Deploy

Push to `main` → GitHub Actions runs lint, tests, build, then `wrangler deploy`
(Worker `hiimchinh-com`) and a smoke test.

Every pull request from this repository gets a preview: CI builds with
`SITE_PREVIEW=true` (drafts shown, every page `noindex, nofollow`, checked by
`pnpm test:preview`), runs `wrangler versions upload --preview-alias pr-<number>`
and comments the link (`https://pr-<number>-hiimchinh-com.ch-nh.workers.dev`) on
the PR. Production is not touched. The link is public, so a draft must already be
safe to show. Secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are set on the repository. The token is narrow (Workers
Scripts only) and is also stored in Bitwarden as
"Cloudflare API token hiimchinh-site-deploy 2026-10-12". DNS for `hiimchinh.com`
is managed in the `hclabsco/infra` repository, not here.

Design decisions: [DESIGN.md](DESIGN.md).
