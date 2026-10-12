import type { APIRoute } from "astro";
import { getLocalizedPosts } from "@/utils/getLocalizedPosts";
import { getPostSlug } from "@/utils/getPostPaths";
import { postToMarkdown } from "@/utils/agentText";

export async function getStaticPaths() {
  const posts = await getLocalizedPosts("en");
  return posts.map(post => ({
    params: { slug: getPostSlug(post.id, post.filePath).replace(/^\//, "") },
    props: { post },
  }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(postToMarkdown(props.post), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
