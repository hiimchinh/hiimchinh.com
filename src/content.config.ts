import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";
import { postStandardViolations } from "@/utils/post-standards";

export const BLOG_PATH = "src/content/posts";

// The online editor (public/admin/config.yml) writes dates as quoted ISO
// strings; hand-written posts use bare YAML timestamps. Accept both.
const date = z.coerce.date();

const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z
      .object({
        author: z.string().default(config.site.author),
        pubDatetime: date,
        modDatetime: date.optional().nullable(),
        title: z.string(),
        featured: z.boolean().optional(),
        draft: z.boolean().optional(),
        tags: z.array(z.string()).default(["others"]),
        ogImage: image().or(z.string()).optional(),
        description: z.string(),
        canonicalURL: z.string().optional(),
        hideEditPost: z.boolean().optional(),
        timezone: z.string().optional(),
        /** Who the post is for, in one line. */
        audience: z.string().optional(),
        /** Questions that reader brings; the AI-reader check asks exactly these. */
        readerQuestions: z.array(z.string()).optional(),
        /** Result of the AI-reader check (AGENTS.md, "Writing a post"). */
        readerCheck: z
          .object({ date, full: z.number(), total: z.number() })
          .optional(),
        /** Every claim checked against its private source (AGENTS.md). */
        factCheck: z
          .object({
            date,
            claims: z.number().int().min(0),
            verified: z.number().int().min(0),
            /** Claims only the owner can vouch for (owner-approval.ts). */
            owner: z.number().int().min(0).optional(),
          })
          .optional(),
      })
      .superRefine((post, ctx) => {
        for (const message of postStandardViolations(post)) {
          ctx.addIssue({ code: "custom", message });
        }
      }),
});

const projects = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.{md,mdx}",
    base: "./src/content/projects",
  }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    period: z.string(),
    status: z.enum(["active", "paused", "archived"]),
    url: z.url().optional(),
    repo: z.url().optional(),
    stack: z.array(z.string()).default([]),
    order: z.number().int(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { posts, pages, projects };
