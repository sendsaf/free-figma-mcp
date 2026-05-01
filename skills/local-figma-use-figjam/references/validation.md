# FigJam Validation and Recovery

## Inspect First

Use:

```text
get_figjam
```

Do this before edits and after large edits.

## Common Issues

| Issue | Fix |
|---|---|
| Node ID unknown | Use `get_figjam` and find the node in XML. |
| Board content overlaps | Reposition in a grid with explicit `x` and `y`. |
| Screenshot fails | Pass a specific exportable `nodeId`. |
| Text not visible | Use larger font sizes and position nodes away from section edges. |
| Diagram too dense | Split into several sections. |

## Fix Positioning

```js
const node = await figma.getNodeByIdAsync("12:34")
node.x = 120
node.y = 160
return { mutatedNodeIds: [node.id] }
```

## Fix Text

```js
const node = await figma.getNodeByIdAsync("12:34")
node.text.characters = "Updated label"
return { mutatedNodeIds: [node.id] }
```

## Final Checklist

- Board has clear sections.
- Sticky notes fit inside sections.
- Important labels are readable.
- Diagram direction is obvious.
- Returned IDs are available for follow-up edits.
