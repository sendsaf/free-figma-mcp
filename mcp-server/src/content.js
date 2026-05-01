export function jsonContent(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function textContent(text) {
  return { content: [{ type: "text", text }] };
}

export function imageContent(result, label = "Screenshot") {
  if (!result.ok) return textContent(`Error: ${result.error || JSON.stringify(result)}`);

  const dataUrl = result.dataUrl || result.screenshot;
  if (!dataUrl || !dataUrl.startsWith("data:image/png;base64,")) {
    return jsonContent(result);
  }

  return {
    content: [
      { type: "text", text: `${label}${result.nodeId ? ` (${result.nodeId})` : ""}` },
      {
        type: "image",
        data: dataUrl.replace("data:image/png;base64,", ""),
        mimeType: "image/png"
      }
    ]
  };
}
