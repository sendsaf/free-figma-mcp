# Local use_figma Gotchas

These rules are tuned for this local MCP bridge, where code is executed in `figma-plugin/code.js` through an async function with the `figma` global.

## Output

Always use `return`.

```js
return {
  createdNodeIds: [frame.id],
  message: "Created frame"
}
```

Do not use:

```js
figma.notify("Done")
figma.closePlugin()
console.log("Done")
```

The agent will not see `console.log`, and `figma.notify` is blocked by local validation.

## Async and Page Loading

Use top-level `await`. Do not wrap your code in an async IIFE.

```js
const pages = figma.root.children
await figma.setCurrentPageAsync(pages[0])
return { pageName: figma.currentPage.name }
```

Do not use:

```js
figma.currentPage = page
```

## Fonts

Load fonts before changing text. If modifying existing text, load that node's current font first.

```js
await figma.loadFontAsync({ family: "Inter", style: "Regular" })
const text = figma.createText()
text.fontName = { family: "Inter", style: "Regular" }
text.characters = "Hello"
return { createdNodeIds: [text.id] }
```

For mixed font text, inspect `getRangeFontName` or load all available fonts you plan to apply.

## Colors

Figma Plugin API color channels are 0-1, not 0-255.

```js
frame.fills = [{ type: "SOLID", color: { r: 0.11, g: 0.18, b: 0.32 } }]
```

Opacity belongs on the paint:

```js
frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.8 }]
```

## Paint Arrays

Clone and reassign fills/strokes. Do not mutate in place and expect stable behavior.

```js
const fills = [...node.fills]
fills[0] = { ...fills[0], opacity: 0.5 }
node.fills = fills
```

## Auto Layout Sizing

Set `FILL` after appending the child to an auto-layout parent.

```js
parent.appendChild(child)
child.layoutSizingHorizontal = "FILL"
```

Setting `FILL` before `appendChild` can throw.

## Positioning

Top-level nodes default to `(0, 0)`. Place new top-level work away from existing content.

```js
const rightMost = Math.max(0, ...figma.currentPage.children
  .filter((node) => "x" in node && "width" in node)
  .map((node) => node.x + node.width))
frame.x = rightMost + 120
frame.y = 0
```

## Return IDs

Every write should return IDs for follow-up calls.

```js
return {
  createdNodeIds,
  mutatedNodeIds,
  pageId: figma.currentPage.id
}
```

## Local MCP Differences

- `fileKey` does not fetch cloud files.
- Tools operate on the active Figma Desktop document.
- `search_design_system` searches the active file only.
- Code Connect data is local JSON, not official Figma backend data.
