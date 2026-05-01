# Implement Design Steering

Use this steering when the deliverable is code in the user's repository based on a Figma selection or Figma URL.

## Required Flow

1. Identify the target:
   - Prefer the current Figma Desktop selection.
   - If the user gives a Figma URL, extract `node-id`, but remember the local server still uses the active desktop file.
2. Call `get_metadata`.
3. Call `get_design_context`.
4. Call `get_screenshot`.
5. Call `get_variable_defs`.
6. Inspect the codebase for framework, styling system, and existing components.
7. Implement using project conventions.
8. Validate against the Figma screenshot.

## Local Differences

- Local `get_design_context` returns metadata and node JSON, not official remote React/Tailwind output.
- The active Figma Desktop file must match the user's intended file.
- `fileKey` is compatibility-only.
- Assets may not be served through the same official remote asset pipeline.

## Implementation Rules

- Reuse existing project components when possible.
- Map Figma variables to project tokens.
- Preserve visual fidelity where project conventions allow.
- Avoid placeholders when the design gives enough information.
- Document intentional deviations briefly.

## References

- `skills/local-figma-implement-design/SKILL.md`
- `docs/TOOLS.md`
- `docs/OFFICIAL_COMPATIBILITY.md`
