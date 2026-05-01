import assert from "node:assert/strict";
import { test } from "node:test";
import { imageContent, jsonContent, textContent } from "../src/content.js";

test("jsonContent returns MCP text content with formatted JSON", () => {
  const result = jsonContent({ ok: true, value: 1 });
  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /"value": 1/);
});

test("textContent returns MCP text content", () => {
  assert.deepEqual(textContent("hello"), {
    content: [{ type: "text", text: "hello" }]
  });
});

test("imageContent converts data URLs to MCP image content", () => {
  const result = imageContent({
    ok: true,
    nodeId: "1:2",
    dataUrl: "data:image/png;base64,ZmFrZQ=="
  });

  assert.equal(result.content[0].type, "text");
  assert.equal(result.content[1].type, "image");
  assert.equal(result.content[1].data, "ZmFrZQ==");
  assert.equal(result.content[1].mimeType, "image/png");
});
