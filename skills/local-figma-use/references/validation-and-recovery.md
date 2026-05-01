# Validation and Recovery

Use this reference after any meaningful write or when a `use_figma` call fails.

## Validation Sequence

1. Use `get_metadata` to confirm structure.
2. Use `get_screenshot` to confirm visual output.
3. Use `get_variable_defs` when token bindings matter.
4. Fix only the broken part with a targeted `use_figma` call.

## Common Failures

| Symptom | Cause | Fix |
|---|---|---|
| `figma.notify() is not supported` | Used notify instead of return | Return a JSON object. |
| `Setting figma.currentPage is not supported` | Used sync page setter | Use `await figma.setCurrentPageAsync(page)`. |
| Text update fails | Font not loaded | Load font before mutation. |
| `FILL can only be set...` | Layout sizing set before append | Append to parent first. |
| Wrong colors | Used 0-255 channels | Convert to 0-1 values. |
| Node not found | Wrong ID or wrong page context | Inspect with `get_metadata`; switch pages if needed. |

## Failed Scripts

Treat failed scripts as not applied. Read the error, correct the script, then retry.

Do not immediately rewrite a huge script. First inspect current state:

```text
get_metadata
get_screenshot
```

## Visual QA Checklist

- Text is not clipped.
- Auto-layout containers have expected padding and gaps.
- Elements do not overlap unintentionally.
- Colors match expected tokens or explicit values.
- Component instances still reference their main components.
- New top-level nodes are not stacked at `(0, 0)`.

## Targeted Fix Pattern

```js
const node = await figma.getNodeByIdAsync("12:34")
node.itemSpacing = 16
node.paddingLeft = 24
node.paddingRight = 24
return { mutatedNodeIds: [node.id] }
```

Prefer small fixes over recreating the whole design.
