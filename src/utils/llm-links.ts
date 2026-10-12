// Chat apps that accept a prefilled prompt through the `q` query parameter.
const CHAT_APPS = [
  { name: "ChatGPT", base: "https://chatgpt.com/" },
  { name: "Claude", base: "https://claude.ai/new" },
] as const;

/** Links that open a chat app already asked to read the post's Markdown copy. */
export function llmChatLinks(markdownUrl: string) {
  const prompt = `Read ${markdownUrl} so I can ask questions about it.`;
  return CHAT_APPS.map(({ name, base }) => ({
    name,
    href: `${base}?q=${encodeURIComponent(prompt)}`,
  }));
}
