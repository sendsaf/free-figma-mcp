import { z } from "zod";
import { imageContent, jsonContent, textContent } from "./content.js";
import { parseValidationError, summarizeShape } from "./schema-probe.js";
import { emitMotionCode } from "./generators/motion.js";
import { normalizeAnimations, makePreset, presetToApplyPayload } from "./generators/preset-bake.js";
import { convertScene } from "./generators/scene-replicate.js";
import { buildCatalog, diffCatalogs } from "./api-catalog.js";

const codeConnectLabels = [
  "React",
  "Web Components",
  "Vue",
  "Svelte",
  "Storybook",
  "Javascript",
  "Swift",
  "Swift UIKit",
  "Objective-C UIKit",
  "SwiftUI",
  "Compose",
  "Java",
  "Kotlin",
  "Android XML Layout",
  "Flutter",
  "Markdown"
];

const useFigmaDescription = `Execute arbitrary JavaScript code in Figma via the Plugin API. This is the master local write tool for creating, editing, deleting, or inspecting Figma objects.

LOCAL HELPERS:
- mcp.createAutoLayout(direction, props) - Create an auto-layout frame without mutating figma globals
- mcp.query(node, selector) - Lightweight node search: mcp.query(figma.currentPage, 'TEXT[name=Title]')
- mcp.set(node, props) - Batch property updates; width/height are routed through resize
- await mcp.screenshot(node, opts) - Export a node as base64 PNG
- mcp.shouldStop() / mcp.throwIfStopped() - Cooperate with the plugin UI Stop button

CRITICAL RULES:
- Colors are 0-1 range: {r: 1, g: 0, b: 0} NOT {r: 255, g: 0, b: 0}
- Use return to send data back; do not use figma.notify()
- Use await figma.setCurrentPageAsync(page) to switch pages
- Load fonts before text operations: await figma.loadFontAsync({ family, style })
- Always return node IDs: return { createdNodeIds: [...], mutatedNodeIds: [...] }

EXAMPLE:
const button = mcp.createAutoLayout('HORIZONTAL', {
  name: 'Button',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 12,
  paddingBottom: 12,
  itemSpacing: 8,
  cornerRadius: 8,
  fills: [{ type: 'SOLID', color: { r: 0.36, g: 0.42, b: 0.96 } }]
})
figma.currentPage.appendChild(button)
return { createdNodeIds: [button.id] }`;

export function registerFigmaTools(server, { sendToFigma, codeConnectStore, capabilities, apiCatalogStore, presetStore }) {
  server.tool(
    "get_capabilities",
    "Detect which Figma Config 2026 Plugin API surfaces (motion, code layers, shaders, slots, weave) are available in the connected Figma Desktop build. Cached server-side; pass refresh to re-probe.",
    {
      refresh: z.boolean().optional().describe("Bypass the cached probe and re-detect.")
    },
    async (args) => {
      try {
        const report = await capabilities.get({ refresh: !!(args && args.refresh), sendToFigma });
        return jsonContent(report);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "introspect_api",
    "Discover the live Figma Plugin API surface in the connected build: enumerate the figma global, probe candidate Config 2026 factory functions (motion/shaders/code layers/slots/weave), and report which node properties actually exist. Use this to find newly-shipped (even undocumented) APIs before wiring dedicated tools.",
    {},
    async () => {
      try {
        const result = await sendToFigma({ type: "introspect_api" }, 30_000);
        return result.ok ? jsonContent(result.introspection) : textContent(`Error: ${result.error}`);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "probe_schema",
    "Discover the exact input schema of a Figma Plugin API method by safely calling it with an invalid argument and decoding the validation error (allowed enum values, required fields, literal discriminators). Denylisted destructive methods are refused.",
    {
      method: z.string().describe("Method name to probe, e.g. 'applyManualKeyframeTrack' or 'importShaderById'."),
      on: z.enum(["figma", "node"]).optional().describe("Probe a figma global method or a node method. Defaults to figma."),
      nodeFactory: z.string().optional().describe("When on='node', which factory creates the throwaway probe node (default createFrame)."),
      invalidArgs: z.array(z.any()).optional().describe("Arguments to pass; defaults to a sentinel invalid value.")
    },
    async (args) => {
      try {
        const result = await sendToFigma({ type: "probe_schema", spec: args }, 30_000);
        if (!result.ok) return textContent(`Error: ${result.error}`);
        if (result.threw && result.errorString) {
          const parsed = parseValidationError(result.errorString);
          return jsonContent({
            method: result.method,
            schema: { ...parsed, shape: summarizeShape(parsed) },
            rawError: result.errorString
          });
        }
        return jsonContent({ method: result.method, threw: false, note: "Call did not throw; no schema leaked.", returned: result.returned });
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "get_motion_context",
    "Read the Motion/animation on a node: applied preset styles, manual keyframe tracks (with per-keyframe easing), derived timeline duration, and prototype reactions as a fallback. Pair with export_motion_code.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to selection or current page.")
    },
    async (args) => {
      try {
        const result = await sendToFigma({ type: "get_motion_context", ...args }, 30_000);
        return result.ok ? jsonContent(result.motion) : textContent(`Error: ${result.error}`);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "export_motion_code",
    "Emit CSS, JSON, or React from a MotionContext (as returned by get_motion_context). Pure/local; no Figma round-trip.",
    {
      motion: z.object({}).passthrough().describe("MotionContext object from get_motion_context."),
      format: z.enum(["css", "json", "react"]).default("css")
    },
    async (args) => jsonContent(emitMotionCode(args.motion, args.format || "css"))
  );

  server.tool(
    "get_slot_context",
    "Inspect component Slots (Config 2026, GA): finds SLOT-typed containers under a node/selection and reports each slot's name and current contents.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to selection or current page.")
    },
    async (args) => {
      try {
        const result = await sendToFigma({ type: "get_slot_context", ...args }, 30_000);
        return result.ok ? jsonContent(result.slotContext) : textContent(`Error: ${result.error}`);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "set_slot_content",
    "Fill a component Slot: move an existing node into it (content.fromNodeId) or create a text child (content.text). Returns mutated node ids.",
    {
      slotNodeId: z.string().describe("The SLOT node id (from get_slot_context)."),
      content: z.object({
        text: z.string().optional().describe("Create a text child with this content."),
        fromNodeId: z.string().optional().describe("Move an existing node into the slot.")
      }).describe("What to place in the slot.")
    },
    async (args) => {
      try {
        const result = await sendToFigma({ type: "set_slot_content", ...args }, 30_000);
        return result.ok ? jsonContent(result) : textContent(`Error: ${result.error}`);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "build_api_catalog",
    "Run the full discovery sweep against the connected Figma build (enumerate the API surface + decode a curated set of input schemas) and persist a versioned catalog to .figma-mcp/api-catalog.json. Reports a diff vs. the previous catalog.",
    {
      persist: z.boolean().optional().describe("Write the catalog to disk (default true).")
    },
    async (args) => {
      try {
        const previous = apiCatalogStore ? apiCatalogStore.read() : null;
        const catalog = await buildCatalog({ sendToFigma });
        let savedPath = null;
        if (apiCatalogStore && args.persist !== false) {
          savedPath = apiCatalogStore.write(catalog);
        }
        const diff = diffCatalogs(previous, catalog);
        return jsonContent({
          savedPath,
          apiVersion: catalog.apiVersion,
          editorType: catalog.editorType,
          capturedAt: catalog.capturedAt,
          globalKeyCount: catalog.globalKeys.length,
          nodeTypeCount: Object.keys(catalog.nodeTypes).length,
          schemaCount: Object.keys(catalog.schemas).length,
          diff
        });
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "get_shader_context",
    "Read shader usage on a node: SHADER-type fills (which reference a shader by id) and the file's available shaders (listAvailableShaders). Note: shader GLSL source is not exposed by the Plugin API; shaders are referenced by id.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to selection or current page.")
    },
    async (args) => {
      try {
        const result = await sendToFigma({ type: "get_shader_context", ...args }, 30_000);
        return result.ok ? jsonContent(result.shaderContext) : textContent(`Error: ${result.error}`);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "bake_preset",
    "Capture the animation a Figma UI preset baked onto the selected node (or nodeId) and save it as a reusable, replayable motion preset. Workflow: apply a named preset (e.g. 'Burst') in Figma's UI, select the node, then call this.",
    {
      name: z.string().describe("Name to store the preset under (e.g. 'Burst')."),
      category: z.string().optional().describe("Optional category, e.g. 'enter' | 'exit' | 'cycle'."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to current selection.")
    },
    async (args) => {
      try {
        const res = await sendToFigma({ type: "bake_preset", nodeId: args.nodeId }, 30_000);
        if (!res.ok) return textContent(`Error: ${res.error}`);
        const capture = res.capture || {};
        if (!capture.supported) {
          return textContent(`No animation found on the node. ${(capture.warnings || []).join(" ")}`);
        }
        const normalized = normalizeAnimations(capture.animations);
        const preset = makePreset(args.name, normalized, { category: args.category });
        if (presetStore) presetStore.save(preset);
        return jsonContent({
          saved: !!presetStore,
          name: preset.name,
          category: preset.category,
          durationSec: preset.durationSec,
          tracks: preset.tracks.map((t) => ({ property: t.property, keyframes: t.keyframes.length })),
          droppedNoOps: normalized.droppedNoOps
        });
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "list_motion_presets",
    "List the baked motion presets available to replay with apply_motion.",
    {},
    async () => jsonContent(presetStore ? presetStore.list() : [])
  );

  server.tool(
    "apply_motion",
    "Apply motion to a node: replay a baked preset by name (preset), or apply inline keyframe tracks. Tracks are [{ property, keyframes:[{ timelinePosition, value, easing }] }].",
    {
      nodeId: z.string().optional().describe("Target node ID. Defaults to current selection."),
      preset: z.string().optional().describe("Name of a baked preset to replay (from list_motion_presets)."),
      tracks: z.array(z.object({}).passthrough()).optional().describe("Inline tracks to apply (alternative to preset)."),
      loop: z.boolean().optional().describe("Set playback looping (auto-applied for cycle presets).")
    },
    async (args) => {
      try {
        let payloads;
        let loop;
        if (args.preset) {
          const preset = presetStore ? presetStore.get(args.preset) : null;
          if (!preset) return textContent(`Error: no baked preset named '${args.preset}'. Use list_motion_presets.`);
          payloads = presetToApplyPayload(preset);
          loop = preset.loop;
        } else if (Array.isArray(args.tracks)) {
          payloads = args.tracks.map((t) => ({ field: { type: "PROPERTY", name: t.property }, track: { keyframes: t.keyframes } }));
          loop = args.loop;
        } else {
          return textContent("Error: provide either 'preset' or 'tracks'.");
        }
        const cmd = { type: "apply_motion", nodeId: args.nodeId, payloads };
        if (typeof loop === "boolean") cmd.loop = loop;
        const res = await sendToFigma(cmd, 30_000);
        return res.ok || res.applied ? jsonContent(res) : textContent(`Error: ${res.error || JSON.stringify(res.errors)}`);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "replicate_scene",
    "Replicate a motion scene from a spec (the JSON produced by the Grok video prompt in MISC/video-replication): builds each element on a scene frame and applies its motion. Uses baked presets for any element with a matching presetMatch.",
    {
      spec: z.object({}).passthrough().describe("Scene spec: { scene, elements:[{name,type,text,layout,startDelay,phases}] }."),
      usePresetMatches: z.boolean().optional().describe("Replace a phase's tracks with a baked preset when presetMatch is set (default true).")
    },
    async (args) => {
      try {
        const presets = presetStore ? presetStore.readAll() : {};
        const plan = convertScene(args.spec, { presets, usePresetMatches: args.usePresetMatches !== false });
        const result = await sendToFigma({ type: "replicate_scene", plan }, 60_000);
        return jsonContent({ ...result, conversionWarnings: plan.warnings, elementCount: plan.elements.length });
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "text_typewriter",
    "Create a typewriter text animation (the first text-motion preset for Figma Motion): reveals each line by animating a clip frame's WIDTH, with a glyph-overflow padding fix so descenders/ascenders/tails are never clipped. Matches the selected text's font by default. Multiple lines type in, hold, and erase in sequence (last stays).",
    {
      lines: z.array(z.string()).describe("Lines to type, in order. Each types in, holds, erases; the last stays."),
      mode: z.enum(["wipe", "step"]).optional().describe("'wipe' = smooth reveal (default); 'step' = true character-by-character."),
      revealSec: z.number().optional().describe("Reveal duration per line (default 1.2)."),
      holdSec: z.number().optional().describe("Hold at full per line (default 1.0)."),
      eraseSec: z.number().optional().describe("Erase duration between lines (default 0.8)."),
      gapSec: z.number().optional().describe("Gap between lines (default 0.2)."),
      fontFamily: z.string().optional().describe("Override font family (default: selected text's font)."),
      fontStyle: z.string().optional().describe("Override font style, e.g. 'Bold'."),
      fontSize: z.number().optional().describe("Override font size (default: selected text's size)."),
      background: z.string().optional().describe("Background hex for a new canvas (default #FFFFFF)."),
      canvasNodeId: z.string().optional().describe("Build inside this existing frame instead of creating one.")
    },
    async (args) => {
      try {
        const result = await sendToFigma({ type: "text_typewriter", ...args }, 60_000);
        return result.ok || result.frameId ? jsonContent(result) : textContent(`Error: ${result.error || JSON.stringify(result.errors)}`);
      } catch (error) {
        return textContent(`Error: ${error.message}`);
      }
    }
  );

  server.tool(
    "get_metadata",
    "Return a sparse XML representation of the current selection, page, or node.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to selection or current page."),
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional()
    },
    async (args) => {
      const result = await sendToFigma({ type: "get_metadata", ...args });
      return result.ok ? textContent(result.xml) : textContent(`Error: ${result.error}`);
    }
  );

  server.tool(
    "get_screenshot",
    "Export a PNG screenshot of the current selection or a node.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to the first selected node or current page."),
      contentsOnly: z.boolean().optional()
    },
    async (args) => imageContent(await sendToFigma({ type: "get_screenshot", ...args }, 30_000))
  );

  server.tool(
    "get_variable_defs",
    "Return variables, styles, and bound variable references used by the selection, page, or node.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to selection or current page."),
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional()
    },
    async (args) => jsonContent(await sendToFigma({ type: "get_variable_defs", ...args }))
  );

  server.tool(
    "get_design_context",
    "Return local design context for a Figma layer: metadata, variables, styles, and an optional screenshot.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      nodeId: z.string().optional().describe("Optional node ID. Defaults to selection or current page."),
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional(),
      disableCodeConnect: z.boolean().optional(),
      excludeScreenshot: z.boolean().optional(),
      forceCode: z.boolean().optional()
    },
    async (args) => {
      const result = await sendToFigma({ type: "get_design_context", ...args }, 30_000);
      if (!result.ok) return textContent(`Error: ${result.error}`);

      const content = [{ type: "text", text: JSON.stringify(result.context, null, 2) }];
      if (result.screenshot?.startsWith("data:image/png;base64,")) {
        content.push({
          type: "image",
          data: result.screenshot.replace("data:image/png;base64,", ""),
          mimeType: "image/png"
        });
      }
      return { content };
    }
  );

  server.tool(
    "search_design_system",
    "Search components, variables, and styles available in the active local Figma file.",
    {
      fileKey: z.string().optional().describe("Accepted for compatibility; local mode uses the active Figma file."),
      query: z.string().describe("Text query to search for."),
      includeComponents: z.boolean().optional(),
      includeVariables: z.boolean().optional(),
      includeStyles: z.boolean().optional(),
      includeLibraryKeys: z.array(z.string()).optional(),
      disableCodeConnect: z.boolean().optional()
    },
    async (args) => jsonContent(await sendToFigma({ type: "search_design_system", ...args }))
  );

  server.tool(
    "create_design_system_rules",
    "Create frontend implementation rules based on the Figma Local MCP workflow.",
    {
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional()
    },
    async (args) => {
      const framework = args.clientFrameworks || "your app framework";
      const language = args.clientLanguages || "your project languages";
      return textContent(`# Figma MCP Integration Rules

Use the Figma Local MCP tools to translate Figma work into code for ${framework} / ${language}.

Required workflow:
1. Use get_metadata first for large selections.
2. Use get_design_context for the exact frame or component being implemented.
3. Use get_screenshot to verify layout fidelity.
4. Use get_variable_defs before hardcoding color, spacing, radius, or typography.
5. Use search_design_system before creating new components from scratch.
6. Prefer existing code components and local Code Connect mappings when get_code_connect_map returns a match.
7. Use use_figma for write operations in Figma and return node IDs for follow-up edits.

Local server note: fileKey parameters are accepted for compatibility, but this server operates on the active Figma Desktop document connected through the Figma Local MCP Bridge.`);
    }
  );

  server.tool(
    "get_code_connect_map",
    "Retrieve locally stored Code Connect-style mappings.",
    {
      fileKey: z.string().optional(),
      nodeId: z.string().optional(),
      codeConnectLabel: z.string().optional(),
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional()
    },
    async (args) => {
      const mappings = codeConnectStore.readMappings();
      if (!args.nodeId) return jsonContent(mappings);
      return jsonContent({ [args.nodeId]: mappings[args.nodeId] || null });
    }
  );

  server.tool(
    "add_code_connect_map",
    "Add a local mapping between a Figma node and a code component.",
    {
      fileKey: z.string().optional(),
      nodeId: z.string().describe("Figma node ID."),
      componentName: z.string().describe("Code component name."),
      source: z.string().describe("Code file path or URL."),
      label: z.enum(codeConnectLabels).optional(),
      template: z.string().optional(),
      templateDataJson: z.string().optional(),
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional()
    },
    async (args) => jsonContent({
      ok: true,
      mapping: codeConnectStore.saveMapping(args),
      mappingsPath: codeConnectStore.mappingsPath
    })
  );

  server.tool(
    "get_code_connect_suggestions",
    "Suggest local Code Connect mappings from component instances found in the active file.",
    {
      fileKey: z.string().optional(),
      nodeId: z.string().optional(),
      excludeMappingPrompt: z.boolean().optional(),
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional()
    },
    async (args) => {
      const result = await sendToFigma({ type: "get_code_connect_candidates", ...args });
      if (!result.ok) return textContent(`Error: ${result.error}`);

      const mappings = codeConnectStore.readMappings();
      const suggestions = result.candidates.map((candidate) => ({
        ...candidate,
        existingMapping: mappings[candidate.nodeId] || null,
        suggestedMapping: mappings[candidate.mainComponentId] || null
      }));
      return jsonContent({ ok: true, suggestions });
    }
  );

  server.tool(
    "send_code_connect_mappings",
    "Save confirmed local Code Connect-style mappings.",
    {
      fileKey: z.string().optional(),
      nodeId: z.string().optional(),
      mappings: z.array(z.object({
        nodeId: z.string(),
        componentName: z.string(),
        source: z.string(),
        label: z.enum(codeConnectLabels).optional(),
        template: z.string().optional(),
        templateDataJson: z.string().optional()
      })),
      clientFrameworks: z.string().optional(),
      clientLanguages: z.string().optional()
    },
    async (args) => {
      const saved = args.mappings.map(codeConnectStore.saveMapping);
      return jsonContent({ ok: true, saved, mappingsPath: codeConnectStore.mappingsPath });
    }
  );

  server.tool(
    "get_figjam",
    "Return FigJam metadata as XML from the active FigJam board or selection.",
    {
      fileKey: z.string().optional(),
      nodeId: z.string().optional(),
      includeImagesOfNodes: z.boolean().optional()
    },
    async (args) => {
      const result = await sendToFigma({ type: "get_figjam", ...args }, 30_000);
      return result.ok ? jsonContent(result) : textContent(`Error: ${result.error}`);
    }
  );

  server.tool(
    "generate_diagram",
    "Generate a local editable diagram from Mermaid syntax in the active Figma/FigJam file.",
    {
      fileKey: z.string().optional(),
      name: z.string().describe("Diagram name."),
      mermaidSyntax: z.string().describe("Mermaid diagram syntax."),
      planKey: z.string().optional(),
      savePlanKey: z.boolean().optional(),
      userIntent: z.string().optional()
    },
    async (args) => jsonContent(await sendToFigma({ type: "generate_diagram", ...args }, 30_000))
  );

  server.tool(
    "generate_figma_design",
    "Create local Figma design layers from a URL or HTML snapshot in the active file.",
    {
      captureId: z.string().optional(),
      outputMode: z.enum(["newFile", "existingFile", "clipboard"]).optional(),
      fileName: z.string().optional(),
      fileKey: z.string().optional(),
      nodeId: z.string().optional(),
      planKey: z.string().optional(),
      url: z.string().optional().describe("Local or remote URL to fetch and convert."),
      html: z.string().optional().describe("Raw HTML to convert into simple Figma layers.")
    },
    async (args) => {
      let html = args.html;
      if (!html && args.url) {
        const response = await fetch(args.url);
        html = await response.text();
      }
      const result = await sendToFigma({ type: "generate_figma_design", ...args, html }, 30_000);
      return jsonContent(result);
    }
  );

  server.tool(
    "create_new_file",
    "Create a new local page in the active Figma document, matching the official tool name for local workflows.",
    {
      editorType: z.enum(["design", "figjam"]).describe("Accepted for compatibility."),
      fileName: z.string().describe("Name for the new local page."),
      planKey: z.string().optional(),
      projectId: z.string().optional()
    },
    async (args) => jsonContent(await sendToFigma({ type: "create_new_file", ...args }))
  );

  server.tool(
    "whoami",
    "Return local MCP identity information.",
    {},
    async () => jsonContent({
      ok: true,
      source: "local",
      user: process.env.USERNAME || process.env.USER || "local-user",
      server: "figma-local-mcp",
      note: "Local mode is connected to Figma Desktop through a plugin and does not receive Figma account seat/team data."
    })
  );

  server.tool(
    "use_figma",
    useFigmaDescription,
    {
      code: z.string().describe("JavaScript code to execute. Has access to the `figma` global and local `mcp` helpers. Use top-level await and return; code is auto-wrapped in async context."),
      description: z.string().describe("A concise description of what the code aims to do"),
      skillNames: z.string().optional().describe("Comma-separated list of skill names being followed, for example `figma-use`.")
    },
    async (args) => {
      const result = await sendToFigma({ type: "execute_code", code: args.code }, 120_000);

      if (!result.ok) {
        return {
          content: [{
            type: "text",
            text: `Error executing code:\n\n${result.error}\n\nDescription: ${args.description}`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: `${args.description}\n\nResult:\n${result.result}`
        }]
      };
    }
  );
}
