import type { APIRoute } from "astro";
import config from "@/config";
import { getLocalizedPosts } from "@/utils/getLocalizedPosts";
import { postToMarkdown } from "@/utils/agentText";

// Every English post in one file, newest first, for agents that want the full text.
export const GET: APIRoute = async () => {
  const posts = await getLocalizedPosts("en");
  const body = [
    `# ${config.site.title}: all posts`,
    "",
    ...posts.map(postToMarkdown),
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
