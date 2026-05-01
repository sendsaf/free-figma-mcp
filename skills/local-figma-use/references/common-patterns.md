# Common Local use_figma Patterns

## Inspect Pages and Top-Level Nodes

```js
const pages = figma.root.children.map((page) => ({
  id: page.id,
  name: page.name,
  childCount: page.children.length
}))
return { pages }
```

## Create a Frame

```js
const frame = figma.createFrame()
frame.name = "Dashboard"
frame.resize(1440, 900)
frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
frame.x = 0
frame.y = 0
figma.currentPage.appendChild(frame)
figma.viewport.scrollAndZoomIntoView([frame])
return { createdNodeIds: [frame.id] }
```

## Create Auto Layout Container

```js
const frame = mcp.createAutoLayout("VERTICAL", {
  name: "Card",
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 20,
  paddingBottom: 20,
  itemSpacing: 12,
  cornerRadius: 8,
  fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
})
figma.currentPage.appendChild(frame)
return { createdNodeIds: [frame.id] }
```

## Add Text

```js
await figma.loadFontAsync({ family: "Inter", style: "Regular" })
const text = figma.createText()
text.name = "Title"
text.fontName = { family: "Inter", style: "Regular" }
text.fontSize = 24
text.characters = "Revenue"
text.fills = [{ type: "SOLID", color: { r: 0.08, g: 0.08, b: 0.1 } }]
figma.currentPage.appendChild(text)
return { createdNodeIds: [text.id] }
```

## Query Nodes

Use native `findAll` or the local `mcp.query(node, selector)` helper.

```js
const titles = mcp.query(figma.currentPage, "TEXT[name=Title]")
return {
  nodeIds: titles.map((node) => node.id),
  count: titles.length
}
```

For complex matching, use `findAll`.

```js
const buttons = figma.currentPage.findAll((node) =>
  node.type === "INSTANCE" && node.name.toLowerCase().includes("button")
)
return { nodeIds: buttons.map((node) => node.id) }
```

## Set Properties

```js
const node = await figma.getNodeByIdAsync("12:34")
mcp.set(node, {
  name: "Updated",
  opacity: 0.8,
  width: 320
})
return { mutatedNodeIds: [node.id] }
```

## Screenshots

Use the MCP `get_screenshot` tool for normal screenshots, or `mcp.screenshot(node, opts)` inside `use_figma`.

```js
const frame = await figma.getNodeByIdAsync("12:34")
const screenshot = await mcp.screenshot(frame, { scale: 1 })
return {
  nodeId: frame.id,
  screenshot
}
```

## Incremental Build Pattern

1. First call: inspect current file and return IDs.
2. Second call: create the skeleton.
3. Third call: populate one section.
4. Fourth call: validate and fix.

Avoid creating an entire complex page in one script.
