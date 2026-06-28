# Requirements Document

Feature: config-2026-tools

## Introduction

This feature expands the **Free Figma MCP** repository with an additive family of MCP tools, Figma plugin handlers, and a companion guidance layer that let an AI agent inspect and assist with the materials introduced at **Figma Config 2026**: Motion (timeline/keyframe animation), Code layers, Shader fills/effects, Slots (GA), Weave graphs, generative-tool scaffolding, and agent context packaging.

Because several Config 2026 surfaces ship behind Figma beta/waitlist flags and are not guaranteed in the public Plugin API, the system is built around **runtime feature detection with graceful degradation**: a capability probe plus a uniform `{ ok, supported, degraded, reason }` result envelope. All `figma.*` access stays in the plugin sandbox; pure transforms (code generation, bundling, capability normalization) run server-side where they can be unit/property-tested in Node. Each new tool ships with a companion skill/steering doc, and guidance is also exposed over the MCP `prompts`/`resources` capabilities. An optional, dev-only capture/proxy mode aligns tool naming/guidance with Figma's official MCP server without reproducing proprietary prompt text verbatim, and Figma's hosted canvas-agent system prompt is explicitly out of scope.

Requirements trace to the design's components (Part A) and correctness properties (Part B).

## Requirements

### Requirement 1: Capability detection with graceful degradation

**User Story:** As an AI agent operating against an unknown Figma Desktop build, I want to know which Config 2026 Plugin API surfaces are available, so that I can choose a dedicated tool path or a documented fallback instead of failing.

#### Acceptance Criteria

1.1. WHEN the `get_capabilities` tool is called THEN the system SHALL return a `CapabilityReport` whose `capabilities` object has a strict boolean at every leaf (motion.reactions/timeline/keyframes, codeLayers.read/sync, shaders.fills/effects, slots.read/write, weave.read).

1.2. WHEN a probed Plugin API surface is missing or its probe throws THEN the system SHALL record that leaf as `false` and SHALL NOT throw.

1.3. WHEN `get_capabilities` is called repeatedly within the cache TTL AND `refresh` is not set THEN the system SHALL return the cached report without a new plugin round-trip; WHEN `refresh` is `true` THEN the system SHALL re-probe.

1.4. WHEN any new context tool returns a result THEN the result SHALL include the uniform envelope fields `ok`, `supported`, `degraded`, and (when degraded or failed) a human-readable `reason`.

1.5. WHEN the capability report is normalized server-side THEN normalization SHALL be idempotent (excluding the `probedAt` timestamp).

1.6. WHEN the Figma plugin is not connected THEN the tool SHALL return the existing "Figma plugin is not connected" error text rather than fabricating a report.

### Requirement 2: Motion context and code emission

**User Story:** As a developer, I want to extract motion/animation from a node and emit CSS, JSON, or React, so that I can implement Figma Motion in code even when the timeline API is unavailable.

#### Acceptance Criteria

2.1. WHEN `get_motion_context` is called AND the Motion timeline API is available THEN the system SHALL return `source === "timeline"`, `degraded === false`, and populated `tracks`.

2.2. WHEN the Motion timeline API is unavailable AND the node has prototype `reactions` THEN the system SHALL return `source === "reactions"`, `degraded === true`, an empty `tracks` array, populated `reactions`, and a warning explaining the fallback.

2.3. WHEN neither timeline nor reactions data exists THEN the system SHALL return `source === "none"`, `supported === false`, and a descriptive warning.

2.4. WHEN motion `tracks` are returned THEN each track's `keyframes` SHALL be sorted ascending by `timeMs` and every `timeMs` SHALL be `>= 0`.

2.5. WHEN `export_motion_code` is called with a `MotionContext`-shaped object and `format ∈ {css, json, react}` THEN the system SHALL return `{ language, code, format, warnings }` and SHALL NOT throw for any such input.

2.6. WHEN `export_motion_code` is called twice with identical input THEN the emitted `code` SHALL be byte-identical (deterministic, independent of object key order).

2.7. WHEN `export_motion_code` receives a context with empty `tracks` THEN `warnings` SHALL be non-empty and `code` SHALL be a valid no-op artifact.

2.8. WHEN CSS is emitted from tracks whose keyframes ascend by `timeMs` THEN the emitted percentages per track SHALL be non-decreasing.

2.9. WHEN code is emitted THEN `language` SHALL agree with `format` (`css`→"css", `json`→"json", `react`→"tsx").

2.10. WHEN `export_motion_code` runs THEN it SHALL execute server-side with no Figma round-trip.

### Requirement 3: Code-layer context and sync

**User Story:** As a developer, I want to read code-backed canvas layers and assist roundtrip sync, so that I can work with Config 2026 code layers without destructive surprises.

#### Acceptance Criteria

3.1. WHEN `get_code_layer_context` is called AND the code-layer API is available THEN the system SHALL return `language`, `source`, `inputs`, and `syncState` with `metadataSource === "api"`.

3.2. WHEN the code-layer API is unavailable THEN the system SHALL fall back to reading `pluginData`/`sharedPluginData`, set `degraded === true`, and set `metadataSource === "pluginData"`.

3.3. WHEN `sync_code_layer` is called THEN it SHALL require an explicit `direction` of `"toDesign"` or `"toCode"` and SHALL NOT perform a destructive write without it.

3.4. WHEN a sync mutation completes THEN the system SHALL return the affected `mutatedNodeIds`.

### Requirement 4: Shader context and code emission

**User Story:** As a developer, I want to read parameterized shader fills/effects and emit shader or CSS code, so that I can reproduce Config 2026 shaders in my target stack.

#### Acceptance Criteria

4.1. WHEN `get_shader_context` is called THEN the system SHALL surface shader-type fills and effects as `ShaderParam` entries including their `uniforms`, and SHALL list any unrecognized paint types in `unknownPaintTypes` for forward-compatibility.

4.2. WHEN no shader paints/effects are present THEN the system SHALL return `supported === false` without throwing.

4.3. WHEN `export_shader_code` is called with `target ∈ {glsl, wgsl, css}` THEN the system SHALL return `{ language, code, format, warnings }` and SHALL run server-side as a pure transform.

### Requirement 5: Slot context and content

**User Story:** As a developer, I want to inspect and fill component Slots, so that I can drive the GA Slots feature programmatically.

#### Acceptance Criteria

5.1. WHEN `get_slot_context` is called on a component/instance with slots THEN the system SHALL return each `SlotDef` with `name`, `acceptedTypes`, and `currentContentId`.

5.2. WHEN `set_slot_content` is called AND the slot API is available THEN the system SHALL fill the slot via the slot API and return `mutatedNodeIds`.

5.3. WHEN the slot API is unavailable THEN the system SHALL fall back to `INSTANCE_SWAP`/child manipulation and report `degraded === true`.

### Requirement 6: Weave context

**User Story:** As a developer, I want to read node-based Weave graphs when present, so that I can understand generative workflows on the canvas.

#### Acceptance Criteria

6.1. WHEN `get_weave_context` is called AND the Weave API is available THEN the system SHALL return graph nodes, edges, and parameters.

6.2. WHEN the Weave API is unavailable THEN the system SHALL fall back to section/connector structure, set `degraded === true`, and return a descriptive warning.

### Requirement 7: Generative-tool scaffolding

**User Story:** As a power user, I want to turn a natural-language tool description into a ready-to-run script, so that I can build canvas tooling without writing Plugin API code from scratch.

#### Acceptance Criteria

7.1. WHEN `scaffold_generative_tool` is called with a valid `GenerativeToolSpec` THEN the system SHALL return a parameterized `use_figma` script and a JSON descriptor.

7.2. WHEN scaffolding runs THEN it SHALL only emit text and SHALL NOT auto-execute the script or mutate the server's tool registry.

7.3. WHEN the spec is invalid or incomplete THEN the system SHALL return `warnings` describing the gaps rather than throwing.

### Requirement 8: Context bundle packaging

**User Story:** As an AI agent, I want one normalized, capability-aware context bundle for a node, so that I can gather everything relevant in a single call.

#### Acceptance Criteria

8.1. WHEN `package_context_bundle` is called THEN the system SHALL assemble the requested parts (metadata, screenshot, variables, motion, shader, slots, codeConnect) into one normalized `ContextBundle` including the `CapabilityReport`.

8.2. WHEN a requested part's capability is unavailable AND no non-degraded fallback exists THEN the system SHALL omit that part and SHALL NOT fabricate data.

8.3. WHEN a part is derived from a degraded source THEN the bundle SHALL preserve that part's `degraded` flag and `reason`.

### Requirement 9: Guidance layer (skills, steering, MCP prompts/resources)

**User Story:** As an AI agent and as a maintainer, I want each new tool paired with workflow guidance delivered both as files and over the protocol, so that tools are reliably discovered and correctly chained.

#### Acceptance Criteria

9.1. WHEN a new tool is added THEN the repository SHALL include a companion skill/steering doc describing when to call it, its call order, how it chains with existing tools (`get_design_context`, `get_screenshot`), and degraded-path handling.

9.2. WHEN the MCP server starts THEN it SHALL register a `prompts` provider exposing the skill workflows and a `resources` provider exposing steering/reference docs, loaded from disk.

9.3. WHEN an MCP client calls `prompts/list`, `prompts/get`, `resources/list`, or `resources/read` THEN the server SHALL respond with the registered guidance content.

9.4. WHEN guidance docs are authored THEN they SHALL paraphrase intent/structure and SHALL NOT embed Figma proprietary prompt text verbatim; a compliance note SHALL be recorded where captured material informed a doc.

### Requirement 10: Official-MCP capture/proxy dev mode

**User Story:** As a maintainer, I want an optional dev-only mode to inspect Figma's official MCP server, so that I can keep tool names and guidance aligned with upstream without guesswork.

#### Acceptance Criteria

10.1. WHEN the server is started WITHOUT the `--proxy` flag (or `FIGMA_MCP_UPSTREAM` env) THEN capture/proxy behavior SHALL be disabled (off by default).

10.2. WHEN started WITH `--proxy` and a valid upstream THEN the system SHALL connect as an MCP client and enumerate the upstream `tools/list`, `prompts/list`, and `resources/list`.

10.3. WHEN captures are produced THEN they SHALL be written read-only under a gitignored `.figma-mcp/capture/` path and SHALL NOT auto-rewrite this server's tools or copy text into shipped artifacts.

10.4. WHEN capture/proxy mode runs THEN it SHALL NOT transmit project code or secrets to the upstream, beyond the standard MCP listing requests.

### Requirement 11: Compliance, security, and scope boundaries

**User Story:** As a maintainer of an open-source repo, I want clear compliance and security boundaries, so that the expansion does not introduce IP, ToS, or attack-surface risks.

#### Acceptance Criteria

11.1. WHEN any new tool or mode is added THEN the system SHALL NOT open new network ports or endpoints beyond the existing `ws://localhost:3055` bridge (capture/proxy acts only as an outbound MCP client).

11.2. WHEN code-layer or shader source is returned THEN the server SHALL treat it as untrusted data and SHALL NOT `eval` it.

11.3. WHEN the feature set is scoped THEN Figma's hosted canvas-agent system prompt SHALL be explicitly out of scope and SHALL NOT be targeted for extraction.

11.4. WHEN existing tools are considered THEN no existing tool SHALL be removed or renamed; all additions SHALL be additive.

## Glossary

- **MCP**: Model Context Protocol — the open standard the server uses to expose tools, prompts, and resources to an AI agent/client.
- **Bridge**: The existing `ws://localhost:3055` WebSocket link between the MCP server (`bridge.sendToFigma`) and the Figma plugin sandbox.
- **Plugin sandbox**: The `figma-plugin/code.js` execution context where the `figma.*` Plugin API is available; the only place that touches Figma internals.
- **Capability probe**: The `get_capabilities` detection that reports which Config 2026 Plugin API surfaces exist in the connected Figma build.
- **Capability envelope**: The uniform `{ ok, supported, degraded, reason }` shape returned by new handlers.
- **Graceful degradation**: Returning best-effort fallback data (e.g., prototype `reactions` instead of the Motion timeline) with `degraded === true` rather than failing.
- **Degraded source**: Data derived from a fallback path rather than the dedicated Config 2026 API.
- **MotionContext / ShaderContext / CodeLayerContext / SlotContext / WeaveContext**: Normalized data models returned by the respective context tools (defined in design.md Data Models).
- **Generator**: A pure, server-side transform (e.g., `emitMotionCode`) that converts an extracted context into code with no Figma round-trip.
- **Slots**: Figma component slots, GA as of Config 2026.
- **Weave**: Figma's node-based generative visual workflow graphs.
- **Code layer**: A code-backed canvas layer with two-way sync to design frames.
- **Guidance layer**: Companion `SKILL.md`/steering docs plus MCP `prompts`/`resources` that tell an agent when and how to use each tool.
- **Capture/proxy mode**: An optional, dev-only mode where this server acts as an MCP client to Figma's official server to inspect its `tools/list`/`prompts/list`/`resources/list`.
- **Hosted canvas-agent system prompt**: Figma's server-side agent prompt; never transmitted over MCP and explicitly out of scope.
