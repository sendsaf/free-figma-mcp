---
name: figma-slots
description: "Use this skill when the task involves component Slots (Config 2026, GA) in the active Figma file: finding the slots in a component or instance, seeing what they contain, or filling a slot with content. Triggers: 'what slots does this component have', 'fill the slot', 'put this in the slot', 'add content to the card slot', 'list the slots', 'create a slot'. Pairs with figma-use for slot creation and any deeper component edits. Verified against component.createSlot() and the SLOT node type."
disable-model-invocation: false
---

# Figma Slots: inspect and fill component slots

Use this skill to work with **Slots** (Config 2026, generally available) on the active Figma Desktop file. Slots are `SLOT`-typed container nodes that live inside components; they define where instance content goes.

Confirmed live: slots are created from a component with `component.createSlot()`, appear as `SLOT`-typed children, and accept content via normal child operations (`slot.appendChild(...)`).

## When to use this skill

- The user asks what slots a component/instance has or what's in them.
- The user wants to place content into a slot (text, or move an existing node in).
- The user wants to create slots on a component (use `figma-use` for the create call).

## Required flow

### Inspect

1. Run `get_slot_context` (optionally with `nodeId`; defaults to selection). It returns each slot's `slotNodeId`, `name`, and current `children`.
2. If `slots` is empty, the target has no `SLOT` descendants — confirm the user is pointing at a component (slots live on components, not plain frames).

### Fill

1. Use `set_slot_content` with the `slotNodeId` from the inspect step and a `content` object:
   - `{ "text": "..." }` to create a text child in the slot, or
   - `{ "fromNodeId": "<id>" }` to move an existing node into the slot.
2. Read back with `get_slot_context` to confirm the slot's `childCount` increased and the content is correct.

### Create (via figma-use)

Load `figma-use`, then in a `use_figma` script call `component.createSlot()` on a `COMPONENT` node, set `slot.name`, and return the created node IDs. Re-inspect with `get_slot_context`.

## Pitfalls

- `createSlot()` auto-names slots (`Slot`, `Slot 2`, …); set `slot.name` explicitly for meaningful names.
- Slots only exist on components; calling slot tools on a detached instance or plain frame returns no slots.
- Filling a slot with `text` loads the node's default font first; if a specific font is required, set it explicitly in a `use_figma` script (see `figma-use` font rules).
