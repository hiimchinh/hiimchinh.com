import assert from "node:assert/strict";
import test from "node:test";
import { llmChatLinks } from "../src/utils/llm-links.ts";

const MD = "https://hiimchinh.com/posts/translate-file-permissions-linux.md";

test("llmChatLinks opens ChatGPT and Claude with a prompt that points at the Markdown copy", () => {
  const links = llmChatLinks(MD);
  assert.deepEqual(
    links.map(l => l.name),
    ["ChatGPT", "Claude"]
  );
  const prompt =
    "Read https://hiimchinh.com/posts/translate-file-permissions-linux.md so I can ask questions about it.";
  assert.equal(
    links[0].href,
    "https://chatgpt.com/?q=Read%20https%3A%2F%2Fhiimchinh.com%2Fposts%2Ftranslate-file-permissions-linux.md%20so%20I%20can%20ask%20questions%20about%20it."
  );
  assert.equal(new URL(links[1].href).origin + new URL(links[1].href).pathname, "https://claude.ai/new");
  assert.equal(new URL(links[1].href).searchParams.get("q"), prompt);
});
