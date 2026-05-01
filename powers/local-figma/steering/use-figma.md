# use_figma Steering

Use this steering when the user wants to create, edit, delete, inspect programmatically, or fix nodes in the active Figma Desktop file.

## Required Flow

1. Inspect first with `get_metadata` or a read-only `use_figma` call.
2. Search existing local components/styles with `search_design_system` if creating UI.
3. Write in small `use_figma` calls.
4. Return all created or mutated node IDs.
5. Validate with `get_metadata` and `get_screenshot`.

## Design-System Generation

For "create a design system from this frame/component" requests:

1. Call `get_design_context` on the exact selected reference.
2. Treat `context.designSystem` as the source of truth.
3. Match extracted colors, typography, radii, spacing, and component/instance names.
4. Use the screenshot to avoid drifting into a generic visual style.

## use_figma Rules

- Use `return` for output.
- Do not use `figma.notify()`, `figma.closePlugin()`, or `console.log()` for agent-visible output.
- Use top-level `await`; do not wrap in an async IIFE.
- Load fonts before text mutations.
- Use 0-1 color channels.
- Use `await figma.setCurrentPageAsync(page)` to switch pages.
- Set `layoutSizingHorizontal` or `layoutSizingVertical` after appending children to auto-layout parents.
- Position new top-level nodes away from `(0, 0)` unless the user asks otherwise.

## References

Use the richer repo skill docs when available:

- `skills/local-figma-use/SKILL.md`
- `skills/local-figma-use/references/gotchas.md`
- `skills/local-figma-use/references/common-patterns.md`
- `skills/local-figma-use/references/validation-and-recovery.md`
