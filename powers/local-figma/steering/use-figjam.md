# FigJam Steering

Use this steering when the active file is FigJam or the user asks for boards, diagrams, stickies, sections, connectors, or FigJam organization.

## Required Flow

1. Inspect with `get_figjam`.
2. Use `generate_diagram` for simple Mermaid-based diagrams.
3. Use `use_figma` for targeted board edits.
4. Return created or mutated node IDs.
5. Validate with `get_figjam` and `get_screenshot` when a node ID is available.

## Local Differences

- Local `generate_diagram` is a simple editable local approximation.
- FigJam APIs differ from Figma Design APIs.
- Use explicit node IDs from `get_figjam` for follow-up edits.

## References

- `skills/local-figma-use-figjam/SKILL.md`
- `skills/local-figma-use-figjam/references/figjam-patterns.md`
- `skills/local-figma-use-figjam/references/diagram-patterns.md`
- `skills/local-figma-use-figjam/references/validation.md`
