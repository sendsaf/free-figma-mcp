# Component Patterns

Use this reference for creating components, variants, and instances in the active local Figma file.

## Inspect Existing Components

Prefer `search_design_system` first:

```text
search_design_system(query="button")
```

Or use `use_figma`:

```js
const components = []
for (const page of figma.root.children) {
  await figma.setCurrentPageAsync(page)
  const matches = page.findAll((node) =>
    node.type === "COMPONENT" || node.type === "COMPONENT_SET"
  )
  components.push(...matches.map((node) => ({
    id: node.id,
    key: node.key,
    name: node.name,
    type: node.type,
    page: page.name
  })))
}
return { components }
```

## Create a Basic Component

```js
await figma.loadFontAsync({ family: "Inter", style: "Medium" })

const button = figma.createComponent()
button.name = "Button/Primary"
button.layoutMode = "HORIZONTAL"
button.primaryAxisAlignItems = "CENTER"
button.counterAxisAlignItems = "CENTER"
button.paddingLeft = 16
button.paddingRight = 16
button.paddingTop = 10
button.paddingBottom = 10
button.itemSpacing = 8
button.cornerRadius = 8
button.fills = [{ type: "SOLID", color: { r: 0.18, g: 0.32, b: 0.86 } }]

const label = figma.createText()
label.fontName = { family: "Inter", style: "Medium" }
label.fontSize = 14
label.characters = "Button"
label.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
button.appendChild(label)

figma.currentPage.appendChild(button)
return { createdNodeIds: [button.id, label.id], componentId: button.id }
```

## Create Variants

```js
const primary = await figma.getNodeByIdAsync("12:34")
const secondary = primary.clone()
secondary.name = "Button/Secondary"
secondary.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
secondary.strokes = [{ type: "SOLID", color: { r: 0.18, g: 0.32, b: 0.86 } }]
secondary.strokeWeight = 1
figma.currentPage.appendChild(secondary)

primary.name = "Type=Primary"
secondary.name = "Type=Secondary"
const set = figma.combineAsVariants([primary, secondary], figma.currentPage)
set.name = "Button"

return { createdNodeIds: [set.id], componentSetId: set.id }
```

## Create an Instance

```js
const component = await figma.getNodeByIdAsync("12:34")
const instance = component.createInstance()
instance.x = component.x + component.width + 120
instance.y = component.y
figma.currentPage.appendChild(instance)
return { createdNodeIds: [instance.id], instanceId: instance.id }
```

## Add Component Properties

```js
const component = await figma.getNodeByIdAsync("12:34")
const label = component.findOne((node) => node.type === "TEXT")

const propId = component.addComponentProperty("Label", "TEXT", "Button")
label.componentPropertyReferences = {
  characters: propId
}

return { mutatedNodeIds: [component.id, label.id], propertyId: propId }
```

## Local Code Connect Mappings

This project stores local Code Connect-style mappings in `.figma-mcp/code-connect-mappings.json`.

Use:

- `add_code_connect_map`
- `get_code_connect_map`
- `get_code_connect_suggestions`
- `send_code_connect_mappings`

These are local mappings only, not official Figma Code Connect backend records.

## Generate Components From a Reference Frame

When deriving a design system from a selected reference, use `get_design_context` first and inspect:

- `context.designSystem.components`
- `context.designSystem.instances`
- `context.designSystem.colors`
- `context.designSystem.typography`
- `context.designSystem.spacing`
- `context.designSystem.radii`

Build components that match the extracted names, dimensions, styles, and repeated structures. Do not create an unrelated generic component library.
