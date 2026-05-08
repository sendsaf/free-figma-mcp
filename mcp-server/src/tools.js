import { z } from "zod";
import { imageContent, jsonContent, textContent } from "./content.js";

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

export function registerFigmaTools(server, { sendToFigma, codeConnectStore }) {
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
