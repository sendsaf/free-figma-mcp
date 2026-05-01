# Local FigJam Patterns

FigJam has a different Plugin API surface than Figma Design. Always inspect with `get_figjam` first.

## Inspect

```text
get_figjam(includeImagesOfNodes=false)
```

Use the returned XML IDs for follow-up `use_figma` calls.

## Create a Section

```js
const section = figma.createSection()
section.name = "Architecture"
section.x = 0
section.y = 0
section.resizeWithoutConstraints(1000, 700)
figma.currentPage.appendChild(section)
return { createdNodeIds: [section.id] }
```

## Create Sticky Notes

```js
const createdNodeIds = []
const items = ["API Gateway", "Auth Service", "Database"]

for (let i = 0; i < items.length; i++) {
  const sticky = figma.createSticky()
  sticky.x = 80 + i * 220
  sticky.y = 120
  sticky.text.characters = items[i]
  figma.currentPage.appendChild(sticky)
  createdNodeIds.push(sticky.id)
}

return { createdNodeIds }
```

## Create Text

```js
await figma.loadFontAsync({ family: "Inter", style: "Bold" })
const text = figma.createText()
text.x = 80
text.y = 40
text.fontName = { family: "Inter", style: "Bold" }
text.fontSize = 28
text.characters = "System Map"
figma.currentPage.appendChild(text)
return { createdNodeIds: [text.id] }
```

## Positioning

Keep board objects on a visible grid:

- Section margin: 40-80 px.
- Sticky spacing: 180-240 px.
- Diagram lanes: 260-320 px apart.
- Keep labels near connectors.

## Return IDs

Always return created node IDs because FigJam screenshots and edits need explicit node IDs.
