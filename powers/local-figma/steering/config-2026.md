# Config 2026 Tools Steering

Use this steering when working with Figma Config 2026 features (Motion, Slots, shaders, code layers) through the local MCP. It explains which tool to reach for and in what order. All `figma.*` access stays in the plugin; the server never assumes a beta API exists.

## Start by knowing what the build supports

Plugin APIs ship (and rename) without notice, so detect before you depend:

1. `get_capabilities` — fast, cached probe of which Config 2026 surfaces exist (motion, shaders, slots, codeLayers, weave). Every new tool returns a `{ ok, supported, degraded, reason }` envelope; honor it.
2. `introspect_api` — deeper map of the live `figma` global and node-type members when you need to discover a method by name.
3. `probe_schema` — when you need a method's exact input shape, probe it: it safely triggers the validation error and decodes the allowed enums / required fields / literals. Never used on destructive methods (denylisted).
4. `build_api_catalog` — run the whole sweep and write `.figma-mcp/api-catalog.json`, with a diff vs. the previous catalog. Run it after a Figma update to see what changed.

The catalog at `.figma-mcp/api-catalog.json` is the source of truth for what this build exposes — consult it before guessing API names.

## Feature routing

- **Motion / animation** → skill `figma-motion`. Read with `get_motion_context`, emit code with `export_motion_code`, author with `applyAnimationStyle` / `applyManualKeyframeTrack` via `use_figma`.
- **Slots** → skill `figma-slots`. Inspect with `get_slot_context`, fill with `set_slot_content`.
- **Shaders** → `figma.listAvailableShaders()` / `importShaderById()` exist; new shader source is authored by the IDE agent and applied via `use_figma`.
- **Code layers / Weave** → not exposed as native Plugin APIs in current builds. Use the local fallback (`pluginData`-backed metadata, `createNodeFromJSXAsync` for JSX) and report `degraded`.

## Principles

- Detect, then act. Prefer a dedicated tool when its capability is `supported`; otherwise use the returned `degraded` data or drop to `use_figma`.
- The IDE agent is the generator. For anything that needs model output (a shader, a motion idea, a layout), generate it locally and write it through the Plugin API — do not depend on Figma's hosted agent.
- Stay honest about degradation. If a result came from a fallback (e.g., motion derived from prototype reactions), say so.
- Compliance: do not reproduce Figma's proprietary prompt text verbatim; Figma's hosted canvas-agent system prompt is out of scope.
