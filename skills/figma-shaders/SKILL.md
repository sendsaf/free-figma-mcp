---
name: figma-shaders
description: "Use this skill when the task involves shader fills/effects in the active Figma file: finding which shaders a node uses, listing the shaders available in the file, or applying an existing shader to a node. Triggers: 'what shader is on this', 'list shaders', 'apply a shader', 'add the shader fill', 'inspect the shader'. Verified against fills of type 'SHADER' and figma.listAvailableShaders() / importShaderById(). Note: shader GLSL source is not exposed by the Plugin API."
disable-model-invocation: false
---

# Figma Shaders: inspect and apply shader fills

Use this skill to work with **shaders** (Config 2026) on the active Figma Desktop file. Confirmed model: a shader is a **fill of `type: "SHADER"`** that references a shader by `id`. The file's shaders are listed by `figma.listAvailableShaders()`, and ids can be imported with `figma.importShaderById(id)`.

**Important limitation:** the Plugin API does **not** expose a shader's GLSL/source code — shaders are referenced by id only. So this skill inspects and applies shaders; it does not extract or generate shader source. To create a *new* visual effect from scratch without an existing shader, author it as an image/gradient fill via `figma-use` instead, or use a shader the file already provides.

## When to use this skill

- The user asks what shader a node uses, or to list the file's shaders.
- The user wants to apply an existing shader to a node.

## Required flow

### Inspect

1. Run `get_shader_context` (optionally with `nodeId`; defaults to selection). It returns:
   - `shaderFills` — any `type: "SHADER"` paints on the node (with their `id`).
   - `availableShaders` — shaders present in the file (`listAvailableShaders`).
   - `degraded: true` with a reason when there are no shader fills and no available shaders.
2. If both lists are empty, tell the user the file has no shaders yet (they're authored in Figma's UI / agent), rather than implying the API is missing.

### Apply (via figma-use)

1. Pick a shader `id` from `availableShaders` (or `figma.importShaderById(id)`).
2. In a `use_figma` script, set the fill: `node.fills = [{ type: "SHADER", id }]` (await `setFillsAsync` for async paint setting).
3. Return mutated node IDs and re-inspect with `get_shader_context`.

## Pitfalls

- A `SHADER` paint requires an `id`; you cannot construct shader behavior inline without a real shader id.
- GLSL source is not readable; do not claim to export shader code.
- `node.fills` can be `figma.mixed`; handle the non-array case (the reader reports it).
