import type { APIRoute } from "astro";
import config from "@/config";
import { getLocalizedPosts } from "@/utils/getLocalizedPosts";
import { getProjects } from "@/utils/getProjects";
import { postMarkdownUrl } from "@/utils/agentText";

// llmstxt.org format: a short index of the site for language models.
export const GET: APIRoute = async () => {
  const posts = await getLocalizedPosts("en");
  const projects = await getProjects("en");
  const site = config.site.url;

  const lines = [
    `# ${config.site.title}`,
    "",
    `> ${config.site.description}`,
    "",
    "Personal site of Chinh Hoang (Hoàng Minh Chính): blog and portfolio. English is the primary language; some pages have Vietnamese versions under /vi/.",
    "",
    "## Posts",
    "",
    ...posts.map(
      p => `- [${p.data.title}](${postMarkdownUrl(p)}): ${p.data.description}`
    ),
    "",
    "## Projects",
    "",
    ...projects.map(
      p =>
        `- [${p.data.title}](${p.data.url ?? new URL("projects/", site).href}): ${p.data.summary}`
    ),
    "",
    "## Optional",
    "",
    `- [About](${new URL("about/", site).href}): who I am and how to reach me`,
    `- [Full text of every post](${new URL("llms-full.txt", site).href})`,
    `- [RSS](${new URL("rss.xml", site).href})`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
