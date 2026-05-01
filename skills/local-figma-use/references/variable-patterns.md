# Variable and Token Patterns

Use this reference when creating variables, reading tokens, or binding tokens to nodes.

## Inspect Existing Variables

Prefer the MCP tool first:

```text
get_variable_defs
```

Or inspect through `use_figma`:

```js
const collections = await figma.variables.getLocalVariableCollectionsAsync()
const variables = await figma.variables.getLocalVariablesAsync()
return {
  collections: collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    modes: collection.modes,
    variableIds: collection.variableIds
  })),
  variables: variables.map((variable) => ({
    id: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType,
    scopes: variable.scopes
  }))
}
```

## Create Color Variables

```js
const collection = figma.variables.createVariableCollection("Local Colors")
collection.renameMode(collection.modes[0].modeId, "Light")
const darkModeId = collection.addMode("Dark")
const lightModeId = collection.modes[0].modeId

const bg = figma.variables.createVariable("color/bg/default", collection, "COLOR")
bg.scopes = ["FRAME_FILL", "SHAPE_FILL"]
bg.setValueForMode(lightModeId, { r: 1, g: 1, b: 1, a: 1 })
bg.setValueForMode(darkModeId, { r: 0.06, g: 0.06, b: 0.07, a: 1 })

return {
  collectionId: collection.id,
  variableIds: [bg.id]
}
```

## Create Number Variables

```js
const collection = figma.variables.createVariableCollection("Spacing")
const modeId = collection.modes[0].modeId

const spacing = figma.variables.createVariable("space/4", collection, "FLOAT")
spacing.scopes = ["GAP", "WIDTH_HEIGHT", "CORNER_RADIUS"]
spacing.setValueForMode(modeId, 16)

return { collectionId: collection.id, variableIds: [spacing.id] }
```

## Bind Fill Variable

For paint variables, use Figma's paint variable helper when available.

```js
const node = await figma.getNodeByIdAsync("12:34")
const variable = await figma.variables.getVariableByIdAsync("VariableID:123")

const paint = figma.variables.setBoundVariableForPaint(
  { type: "SOLID", color: { r: 1, g: 1, b: 1 } },
  "color",
  variable
)

node.fills = [paint]
return { mutatedNodeIds: [node.id], variableId: variable.id }
```

## Bind Non-Paint Variable

```js
const node = await figma.getNodeByIdAsync("12:34")
const radius = await figma.variables.getVariableByIdAsync("VariableID:456")
node.setBoundVariable("cornerRadius", radius)
return { mutatedNodeIds: [node.id] }
```

## Rules

- Always set `variable.scopes` explicitly.
- Reuse existing collections when names match.
- Return collection and variable IDs.
- Use `get_variable_defs` to verify bindings after writes.
