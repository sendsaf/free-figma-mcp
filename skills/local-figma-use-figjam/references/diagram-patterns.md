# Local Diagram Patterns

This local MCP has `generate_diagram`, but it is a local approximation. It creates simple editable diagram/source layers from Mermaid syntax.

## Use generate_diagram

```text
generate_diagram(
  name="Auth Flow",
  mermaidSyntax="flowchart LR\nA[Login] --> B[Validate]\nB --> C[Dashboard]"
)
```

## Mermaid Guidance

Keep diagrams simple:

- `flowchart LR` for process flows.
- `sequenceDiagram` for service interactions.
- `stateDiagram-v2` for state machines.
- `erDiagram` for data models.

Avoid very large Mermaid graphs. Split complex diagrams into sections.

## Manual FigJam Diagram with use_figma

Use this when you need more control than `generate_diagram`.

```js
const nodes = [
  { label: "Client", x: 80, y: 120 },
  { label: "API", x: 340, y: 120 },
  { label: "DB", x: 600, y: 120 }
]

const createdNodeIds = []
for (const item of nodes) {
  const sticky = figma.createSticky()
  sticky.x = item.x
  sticky.y = item.y
  sticky.text.characters = item.label
  figma.currentPage.appendChild(sticky)
  createdNodeIds.push(sticky.id)
}

return { createdNodeIds }
```

## Validation

After creating the diagram:

1. Call `get_figjam`.
2. Check that expected node labels exist.
3. Call `get_screenshot` on a section or key node if visual validation is needed.
