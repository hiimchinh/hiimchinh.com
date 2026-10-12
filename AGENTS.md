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
- About page: `src/content/pages/{en,vi}/about.md`. Home hero: `src/data/home.ts`.
- UI strings: `src/i18n/lang/{en,vi}.ts`. Add a key to `src/i18n/types.ts` first.
- Frontmatter is validated by `src/content.config.ts`; a wrong field fails the build.
- New posts start with `draft: true`. Remove it to publish.

## Non-negotiables

1. **Never name an employer (past or present) or a customer** in public copy. Frame
   past work by domain and years, e.g. "seven years at a cloud communications
   platform". No superlatives that identify a company ("largest … in Vietnam").
   `tests/restricted-references.test.ts` enforces this.
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
(Worker `hiimchinh-com`) and a smoke test. Secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are set on the repository. The token is narrow (Workers
Scripts only) and is also stored in Bitwarden as
"Cloudflare API token hiimchinh-site-deploy 2026-10-12". DNS for `hiimchinh.com`
is managed in the `hclabsco/infra` repository, not here.

Design decisions: [DESIGN.md](DESIGN.md).
