// =============================================================================
// Figma Local MCP Bridge — Plugin Sandbox (code.js)
// Receives commands from ui.html (which relays from the MCP WebSocket server)
// and executes them via the Figma Plugin API.
// =============================================================================

figma.showUI(__html__, { width: 340, height: 380, title: "Figma Local MCP" });

var activeRequestId = null;
var stoppedRequests = {};

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

// CSS-like query selector for nodes
function queryHelper(selector) {
  const results = [];
  
  // Parse selector (simplified - supports TYPE[name=Value])
  const typeMatch = selector.match(/^([A-Z_]+)/);
  const nameMatch = selector.match(/\[name=([^\]]+)\]/);
  const nameStartsMatch = selector.match(/\[name\^=([^\]]+)\]/);
  
  const type = typeMatch ? typeMatch[1] : null;
  const name = nameMatch ? nameMatch[1].replace(/['"]/g, '') : null;
  const nameStarts = nameStartsMatch ? nameStartsMatch[1].replace(/['"]/g, '') : null;
  
  this.findAll(node => {
    if (type && node.type !== type) return false;
    if (name && node.name !== name) return false;
    if (nameStarts && !node.name.startsWith(nameStarts)) return false;
    results.push(node);
    return false;
  });
  
  return results;
}

// Batch property updates
function setHelper(props) {
  // Handle layoutMode first (affects other properties)
  if (props.layoutMode !== undefined) {
    this.layoutMode = props.layoutMode;
  }
  
  for (const [key, value] of Object.entries(props)) {
    if (key === 'layoutMode') continue; // Already handled
    
    if (key === 'width' || key === 'height') {
      this.resize(
        key === 'width' ? value : this.width,
        key === 'height' ? value : this.height
      );
    } else {
      this[key] = value;
    }
  }
  return this;
}

// Create auto-layout frame with sensible defaults. Kept internal because Figma
// plugin objects are not extensible in some runtimes.
function createAutoLayoutFrame(direction, props) {
  if (typeof direction === 'object') {
    props = direction;
    direction = 'HORIZONTAL';
  }
  direction = direction || 'HORIZONTAL';
  props = props || {};
  
  const frame = figma.createFrame();
  frame.layoutMode = direction;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.layoutSizingHorizontal = 'HUG';
  frame.layoutSizingVertical = 'HUG';
  
  for (const [key, value] of Object.entries(props)) {
    if (key === 'width' || key === 'height') {
      frame.resize(
        key === 'width' ? value : frame.width,
        key === 'height' ? value : frame.height
      );
    } else {
      frame[key] = value;
    }
  }
  
  return frame;
}

// Inline screenshot (returns base64)
async function screenshotHelper(opts) {
  opts = opts || {};
  const scale = opts.scale || 0.5;
  
  try {
    const bytes = await this.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale }
    });
    
    // Convert to base64
    const base64 = figma.base64Encode(bytes);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    return { error: error.message };
  }
}

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

figma.ui.onmessage = async (msg) => {
  activeRequestId = msg && msg.requestId ? msg.requestId : null;
  try {
    switch (msg.type) {

      // -----------------------------------------------------------------------
      case "bridge-connected": {
        break;
      }

      // -----------------------------------------------------------------------
      case "resize_ui": {
        var width = typeof msg.width === "number" ? msg.width : 340;
        var height = typeof msg.height === "number" ? msg.height : 200;
        figma.ui.resize(width, height);
        break;
      }

      // -----------------------------------------------------------------------
      case "focus_selection": {
        if (figma.currentPage.selection && figma.currentPage.selection.length > 0) {
          figma.viewport.scrollAndZoomIntoView(Array.from(figma.currentPage.selection));
        }
        break;
      }

      // -----------------------------------------------------------------------
      case "stop_current": {
        if (msg.requestId) {
          stoppedRequests[msg.requestId] = true;
        }
        break;
      }

      // -----------------------------------------------------------------------
      case "get_metadata": {
        const nodes = await getTargetNodes(msg);
        respond({
          ok: true,
          source: "local-plugin",
          xml: serializeNodesXml(nodes),
          nodeIds: nodes.map((node) => node.id)
        });
        break;
      }

      // -----------------------------------------------------------------------
      case "get_screenshot": {
        const nodes = await getTargetNodes(msg);
        const node = nodes.find((item) => item.type !== "PAGE") || nodes[0];
        if (!node || typeof node.exportAsync !== "function") {
          respond({ ok: false, error: "No exportable node found for screenshot" });
          break;
        }

        const dataUrl = await exportNodePng(node, 1);
        respond({
          ok: true,
          source: "local-plugin",
          nodeId: node.id,
          nodeName: node.name,
          dataUrl
        });
        break;
      }

      // -----------------------------------------------------------------------
      case "get_variable_defs": {
        const nodes = await getTargetNodes(msg);
        const variableDefs = await collectVariableDefs(nodes);
        respond({
          ok: true,
          source: "local-plugin",
          nodeIds: nodes.map((node) => node.id),
          variableDefs
        });
        break;
      }

      // -----------------------------------------------------------------------
      case "get_design_context": {
        const nodes = await getTargetNodes(msg);
        const variableDefs = await collectVariableDefs(nodes);
        const designSystem = extractDesignSystemSummary(nodes);
        const context = {
          source: "local-plugin",
          documentName: figma.root.name,
          pageName: figma.currentPage.name,
          selectedNodeIds: figma.currentPage.selection.map((node) => node.id),
          nodeIds: nodes.map((node) => node.id),
          metadataXml: serializeNodesXml(nodes),
          nodes: nodes.map((node) => serializeNodeJson(node, 0, 5)),
          designSystem,
          variableDefs,
          guidance: {
            designSystemGeneration: "Use designSystem.colors, typography, radii, spacing, components, and instances as the primary source. Do not invent a different visual language when the selected frame contains enough reference material.",
            referencePriority: [
              "Selected node screenshot",
              "Component and instance inventory",
              "Local variables and style IDs",
              "Extracted repeated colors, typography, radii, and spacing"
            ]
          },
          note: "Local design context is generated from the active Figma Desktop document. It is an extracted reference, not official cloud-generated code."
        };

        let screenshot = null;
        if (!msg.excludeScreenshot) {
          const exportable = nodes.find((item) => item.type !== "PAGE" && typeof item.exportAsync === "function");
          if (exportable) screenshot = await exportNodePng(exportable, 1);
        }

        respond({ ok: true, context, screenshot });
        break;
      }

      // -----------------------------------------------------------------------
      case "search_design_system": {
        respond({
          ok: true,
          source: "local-plugin",
          results: await searchLocalDesignSystem(msg)
        });
        break;
      }

      // -----------------------------------------------------------------------
      case "get_code_connect_candidates": {
        const nodes = await getTargetNodes(msg);
        respond({
          ok: true,
          source: "local-plugin",
          candidates: await getCodeConnectCandidates(nodes)
        });
        break;
      }

      // -----------------------------------------------------------------------
      case "get_figjam": {
        const nodes = await getTargetNodes(msg);
        const response = {
          ok: true,
          source: "local-plugin",
          editorType: figma.editorType,
          xml: serializeNodesXml(nodes),
          nodeIds: nodes.map((node) => node.id)
        };

        if (msg.includeImagesOfNodes) {
          response.images = [];
          for (const node of nodes) {
            if (node.type !== "PAGE" && typeof node.exportAsync === "function") {
              response.images.push({
                nodeId: node.id,
                name: node.name,
                dataUrl: await exportNodePng(node, 0.5)
              });
            }
          }
        }

        respond(response);
        break;
      }

      // -----------------------------------------------------------------------
      case "generate_diagram": {
        const result = await createLocalDiagram(msg.name || "Diagram", msg.mermaidSyntax || "");
        respond(mergeObjects({ ok: true, source: "local-plugin" }, result));
        break;
      }

      // -----------------------------------------------------------------------
      case "generate_figma_design": {
        const result = await createDesignFromHtml(msg);
        respond(mergeObjects({ ok: true, source: "local-plugin" }, result));
        break;
      }

      // -----------------------------------------------------------------------
      case "create_new_file": {
        const page = figma.createPage();
        page.name = msg.fileName || "New Figma Local MCP page";
        await figma.setCurrentPageAsync(page);
        respond({
          ok: true,
          source: "local-plugin",
          message: "Created a new page in the active local Figma document",
          pageId: page.id,
          pageName: page.name
        });
        break;
      }

      // -----------------------------------------------------------------------
      case "execute_code": {
        // Execute arbitrary JavaScript code with access to figma API
        try {
          // Pre-flight validation
          const validationErrors = [];
          
          if (msg.code.includes('figma.notify(')) {
            validationErrors.push('figma.notify() is not supported - use return instead');
          }
          
          if (msg.code.includes('figma.currentPage =')) {
            validationErrors.push('Use await figma.setCurrentPageAsync(page) instead of figma.currentPage =');
          }
          
          if (/color:\s*\{\s*r:\s*\d{2,3}/.test(msg.code)) {
            validationErrors.push('Colors must be 0-1 range, not 0-255. Use {r: 1, g: 0, b: 0} not {r: 255, g: 0, b: 0}');
          }
          
          if (validationErrors.length > 0) {
            respond({ 
              ok: false, 
              error: 'Pre-flight validation failed:\n\n' + validationErrors.join('\n\n')
            });
            break;
          }
          
          // Create async function with figma in scope
          // Code is automatically wrapped in async context, supports top-level await and return
          var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          var fn = new AsyncFunction('figma', 'mcp', msg.code);
          throwIfRequestStopped(activeRequestId);
          var result = await fn(figma, createMcpHelpers());
          throwIfRequestStopped(activeRequestId);
          
          // Validate return value
          if (result === undefined || result === null) {
            result = { 
              success: true,
              message: "Code executed successfully (no return value)"
            };
          } else if (typeof result !== 'object') {
            result = { 
              success: true,
              rawResult: result
            };
          } else {
            // Check if node IDs were returned
            if (!result.createdNodeIds && !result.mutatedNodeIds && !result.nodeId && !result.nodeIds) {
              result.warning = 'No node IDs returned - subsequent calls cannot reference created/modified nodes';
            }
          }
          
          // Serialize result
          var serializedResult;
          try {
            serializedResult = JSON.stringify(result, null, 2);
          } catch (e) {
            serializedResult = String(result);
          }
          
          respond({ ok: true, result: serializedResult });
        } catch (error) {
          // Enhanced error messages
          let errorMsg = error.message;
          let hint = '';
          
          if (errorMsg.includes('not implemented')) {
            hint = '\n\n💡 Hint: figma.notify() is not supported. Use return instead to send data back.';
          } else if (errorMsg.includes('Setting figma.currentPage')) {
            hint = '\n\n💡 Hint: Use await figma.setCurrentPageAsync(page) instead of figma.currentPage = page';
          } else if (errorMsg.includes('no setter')) {
            hint = '\n\n💡 Hint: width and height are read-only. Use node.resize(width, height) instead.';
          } else if (errorMsg.includes('FILL can only be set')) {
            hint = '\n\n💡 Hint: Set layoutSizingHorizontal/Vertical = "FILL" AFTER appendChild(), not before.';
          } else if (errorMsg.includes('font')) {
            hint = '\n\n💡 Hint: Load fonts with await figma.loadFontAsync({family, style}) before modifying text.';
          }
          
          respond({ 
            ok: false, 
            error: errorMsg + hint + (error.stack ? '\n\n' + error.stack : '')
          });
        }
        break;
      }

      // -----------------------------------------------------------------------
      default:
        respond({ ok: false, error: `Unknown command type: "${msg.type}"` });
    }

  } catch (error) {
    var errorMessage = { type: "result", ok: false, error: String(error) };
    if (activeRequestId) errorMessage.requestId = activeRequestId;
    figma.ui.postMessage(errorMessage);
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function respond(payload) {
  var message = { type: "result" };
  if (activeRequestId) message.requestId = activeRequestId;
  for (var key in payload) {
    if (payload.hasOwnProperty(key)) {
      message[key] = payload[key];
    }
  }
  figma.ui.postMessage(message);
}

function isRequestStopped(requestId) {
  return !!(requestId && stoppedRequests[requestId]);
}

function throwIfRequestStopped(requestId) {
  if (isRequestStopped(requestId)) {
    throw new Error("Stopped by user from the Figma Local MCP Bridge UI.");
  }
}

function hexToRgb(hex) {
  const clean   = hex.replace("#", "");
  const bigint  = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >>  8) & 255) / 255,
    b: ( bigint        & 255) / 255
  };
}

async function getTargetNodes(msg) {
  if (msg.nodeId) {
    const node = await getNodeByIdCompat(msg.nodeId);
    if (!node) throw new Error(`Node not found: ${msg.nodeId}`);
    return [node];
  }

  if (figma.currentPage.selection && figma.currentPage.selection.length > 0) {
    return Array.from(figma.currentPage.selection);
  }

  return [figma.currentPage];
}

async function getNodeByIdCompat(nodeId) {
  if (typeof figma.getNodeByIdAsync === "function") {
    return await figma.getNodeByIdAsync(nodeId);
  }
  return figma.getNodeById(nodeId);
}

function serializeNodesXml(nodes) {
  return `<figma document="${escapeXml(figma.root.name)}" page="${escapeXml(figma.currentPage.name)}">\n${nodes
    .map((node) => serializeNodeXml(node, 1, 5))
    .join("\n")}\n</figma>`;
}

function serializeNodeXml(node, depth, maxDepth) {
  const indent = "  ".repeat(depth);
  const attrs = [
    `id="${escapeXml(node.id)}"`,
    `name="${escapeXml(node.name || "")}"`,
    `type="${escapeXml(node.type)}"`
  ];

  if ("x" in node) attrs.push(`x="${round(node.x)}"`);
  if ("y" in node) attrs.push(`y="${round(node.y)}"`);
  if ("width" in node) attrs.push(`width="${round(node.width)}"`);
  if ("height" in node) attrs.push(`height="${round(node.height)}"`);
  if ("visible" in node) attrs.push(`visible="${node.visible}"`);
  if ("layoutMode" in node && node.layoutMode) attrs.push(`layoutMode="${node.layoutMode}"`);

  const children = "children" in node ? Array.from(node.children) : [];
  if (children.length === 0 || depth >= maxDepth) {
    return `${indent}<node ${attrs.join(" ")}${children.length ? ` children="${children.length}"` : ""} />`;
  }

  return `${indent}<node ${attrs.join(" ")}>\n${children
    .map((child) => serializeNodeXml(child, depth + 1, maxDepth))
    .join("\n")}\n${indent}</node>`;
}

function serializeNodeJson(node, depth, maxDepth) {
  const result = {
    id: node.id,
    name: node.name,
    type: node.type
  };

  if ("x" in node) result.x = round(node.x);
  if ("y" in node) result.y = round(node.y);
  if ("width" in node) result.width = round(node.width);
  if ("height" in node) result.height = round(node.height);
  if ("visible" in node) result.visible = node.visible;
  if ("layoutMode" in node) result.layoutMode = node.layoutMode;
  if ("primaryAxisAlignItems" in node) result.primaryAxisAlignItems = node.primaryAxisAlignItems;
  if ("counterAxisAlignItems" in node) result.counterAxisAlignItems = node.counterAxisAlignItems;
  if ("primaryAxisSizingMode" in node) result.primaryAxisSizingMode = node.primaryAxisSizingMode;
  if ("counterAxisSizingMode" in node) result.counterAxisSizingMode = node.counterAxisSizingMode;
  if ("layoutSizingHorizontal" in node) result.layoutSizingHorizontal = node.layoutSizingHorizontal;
  if ("layoutSizingVertical" in node) result.layoutSizingVertical = node.layoutSizingVertical;
  if ("itemSpacing" in node) result.itemSpacing = node.itemSpacing;
  if ("paddingLeft" in node) result.paddingLeft = node.paddingLeft;
  if ("paddingRight" in node) result.paddingRight = node.paddingRight;
  if ("paddingTop" in node) result.paddingTop = node.paddingTop;
  if ("paddingBottom" in node) result.paddingBottom = node.paddingBottom;
  if ("cornerRadius" in node) result.cornerRadius = node.cornerRadius;
  if ("topLeftRadius" in node) result.cornerRadii = {
    topLeft: node.topLeftRadius,
    topRight: node.topRightRadius,
    bottomRight: node.bottomRightRadius,
    bottomLeft: node.bottomLeftRadius
  };
  if ("characters" in node) result.characters = node.characters;
  if ("fontSize" in node) result.fontSize = node.fontSize;
  if ("fontName" in node) result.fontName = node.fontName;
  if ("fontWeight" in node) result.fontWeight = node.fontWeight;
  if ("lineHeight" in node) result.lineHeight = node.lineHeight;
  if ("letterSpacing" in node) result.letterSpacing = node.letterSpacing;
  if ("textCase" in node) result.textCase = node.textCase;
  if ("textDecoration" in node) result.textDecoration = node.textDecoration;
  if ("fills" in node) result.fills = summarizePaints(node.fills);
  if ("strokes" in node) result.strokes = summarizePaints(node.strokes);
  if ("fillStyleId" in node) result.fillStyleId = node.fillStyleId;
  if ("strokeStyleId" in node) result.strokeStyleId = node.strokeStyleId;
  if ("textStyleId" in node) result.textStyleId = node.textStyleId;
  if ("effectStyleId" in node) result.effectStyleId = node.effectStyleId;
  if ("effects" in node) result.effects = node.effects;
  if ("componentPropertyDefinitions" in node) result.componentPropertyDefinitions = node.componentPropertyDefinitions;
  if ("componentProperties" in node) result.componentProperties = node.componentProperties;
  if ("variantProperties" in node) result.variantProperties = node.variantProperties;
  if (node.boundVariables) result.boundVariables = node.boundVariables;

  if ("children" in node && depth < maxDepth) {
    result.children = Array.from(node.children).map((child) => serializeNodeJson(child, depth + 1, maxDepth));
  } else if ("children" in node) {
    result.childCount = node.children.length;
  }

  return result;
}

function summarizePaints(paints) {
  if (!Array.isArray(paints)) return paints;
  return paints.map((paint) => {
    const result = { type: paint.type, visible: paint.visible, opacity: paint.opacity };
    if (paint.color) result.color = rgbToHex(paint.color);
    if (paint.gradientStops) result.gradientStops = paint.gradientStops.length;
    if (paint.imageHash) result.imageHash = paint.imageHash;
    return result;
  });
}

function extractDesignSystemSummary(nodes) {
  var allNodes = flattenNodes(nodes);
  var colors = {};
  var typography = {};
  var radii = {};
  var spacing = {};
  var effects = {};
  var layoutModes = {};
  var components = [];
  var instances = [];
  var textSamples = [];
  var styleRefs = {
    fillStyleIds: {},
    strokeStyleIds: {},
    textStyleIds: {},
    effectStyleIds: {}
  };

  for (var i = 0; i < allNodes.length; i++) {
    var node = allNodes[i];

    if ("fills" in node) collectPaintColors(colors, node.fills, node, "fill");
    if ("strokes" in node) collectPaintColors(colors, node.strokes, node, "stroke");
    if ("effects" in node) collectEffects(effects, node.effects, node);
    if ("layoutMode" in node && node.layoutMode) addCount(layoutModes, node.layoutMode, node);
    if ("cornerRadius" in node && typeof node.cornerRadius === "number") addCount(radii, String(round(node.cornerRadius)), node);
    if ("itemSpacing" in node && typeof node.itemSpacing === "number") addCount(spacing, "gap:" + round(node.itemSpacing), node);
    if ("paddingLeft" in node && typeof node.paddingLeft === "number") addCount(spacing, "paddingLeft:" + round(node.paddingLeft), node);
    if ("paddingRight" in node && typeof node.paddingRight === "number") addCount(spacing, "paddingRight:" + round(node.paddingRight), node);
    if ("paddingTop" in node && typeof node.paddingTop === "number") addCount(spacing, "paddingTop:" + round(node.paddingTop), node);
    if ("paddingBottom" in node && typeof node.paddingBottom === "number") addCount(spacing, "paddingBottom:" + round(node.paddingBottom), node);

    collectStyleRef(styleRefs.fillStyleIds, node, "fillStyleId");
    collectStyleRef(styleRefs.strokeStyleIds, node, "strokeStyleId");
    collectStyleRef(styleRefs.textStyleIds, node, "textStyleId");
    collectStyleRef(styleRefs.effectStyleIds, node, "effectStyleId");

    if (node.type === "TEXT") {
      collectTypography(typography, node);
      if (textSamples.length < 30) {
        textSamples.push({
          nodeId: node.id,
          name: node.name,
          characters: truncateString(node.characters || "", 140),
          fontName: node.fontName,
          fontSize: node.fontSize,
          lineHeight: node.lineHeight,
          fills: summarizePaints(node.fills)
        });
      }
    }

    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      components.push(summarizeComponentNode(node));
    }

    if (node.type === "INSTANCE") {
      instances.push(summarizeInstanceNode(node));
    }
  }

  return {
    colors: toSortedSummary(colors, 40),
    typography: toSortedSummary(typography, 40),
    radii: toSortedSummary(radii, 30),
    spacing: toSortedSummary(spacing, 50),
    effects: toSortedSummary(effects, 30),
    layoutModes: toSortedSummary(layoutModes, 10),
    styleRefs: {
      fillStyleIds: toSortedSummary(styleRefs.fillStyleIds, 30),
      strokeStyleIds: toSortedSummary(styleRefs.strokeStyleIds, 30),
      textStyleIds: toSortedSummary(styleRefs.textStyleIds, 30),
      effectStyleIds: toSortedSummary(styleRefs.effectStyleIds, 30)
    },
    components: components.slice(0, 80),
    instances: instances.slice(0, 120),
    textSamples: textSamples,
    inferredInstructions: inferDesignSystemInstructions(colors, typography, radii, spacing, components, instances)
  };
}

function collectPaintColors(target, paints, node, usage) {
  if (!Array.isArray(paints)) return;
  for (var i = 0; i < paints.length; i++) {
    var paint = paints[i];
    if (!paint || paint.visible === false || !paint.color) continue;
    var key = rgbToHex(paint.color);
    addCount(target, key, node, {
      usage: usage,
      opacity: paint.opacity === undefined ? 1 : paint.opacity
    });
  }
}

function collectTypography(target, node) {
  var font = "Mixed";
  if (node.fontName && typeof node.fontName === "object") {
    font = node.fontName.family + " " + node.fontName.style;
  }
  var lineHeight = node.lineHeight && node.lineHeight.value !== undefined
    ? node.lineHeight.value + node.lineHeight.unit
    : "AUTO";
  var letterSpacing = node.letterSpacing && node.letterSpacing.value !== undefined
    ? node.letterSpacing.value + node.letterSpacing.unit
    : "0";
  var key = font + " / " + node.fontSize + " / " + lineHeight + " / " + letterSpacing;
  addCount(target, key, node, {
    fontName: node.fontName,
    fontSize: node.fontSize,
    lineHeight: node.lineHeight,
    letterSpacing: node.letterSpacing,
    textCase: node.textCase,
    textDecoration: node.textDecoration
  });
}

function collectEffects(target, effectsList, node) {
  if (!Array.isArray(effectsList)) return;
  for (var i = 0; i < effectsList.length; i++) {
    var effect = effectsList[i];
    if (!effect || effect.visible === false) continue;
    var key = effect.type + ":" + JSON.stringify({
      color: effect.color,
      offset: effect.offset,
      radius: effect.radius,
      spread: effect.spread
    });
    addCount(target, key, node, effect);
  }
}

function collectStyleRef(target, node, prop) {
  if (prop in node && node[prop] && node[prop] !== figma.mixed) {
    addCount(target, String(node[prop]), node);
  }
}

function addCount(target, key, node, extra) {
  if (!key || key === "undefined" || key === "null") return;
  if (!target[key]) {
    target[key] = {
      value: key,
      count: 0,
      examples: []
    };
    if (extra !== undefined) target[key].details = extra;
  }
  target[key].count += 1;
  if (target[key].examples.length < 8 && node) {
    target[key].examples.push({
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type
    });
  }
}

function toSortedSummary(map, limit) {
  var items = [];
  for (var key in map) {
    if (map.hasOwnProperty(key)) items.push(map[key]);
  }
  items.sort(function(a, b) {
    return b.count - a.count;
  });
  return items.slice(0, limit);
}

function summarizeComponentNode(node) {
  return {
    id: node.id,
    key: node.key,
    name: node.name,
    type: node.type,
    description: node.description,
    width: "width" in node ? round(node.width) : null,
    height: "height" in node ? round(node.height) : null,
    variantProperties: "variantProperties" in node ? node.variantProperties : null,
    componentPropertyDefinitions: "componentPropertyDefinitions" in node ? node.componentPropertyDefinitions : null,
    childCount: "children" in node ? node.children.length : 0
  };
}

function summarizeInstanceNode(node) {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    width: "width" in node ? round(node.width) : null,
    height: "height" in node ? round(node.height) : null,
    componentProperties: "componentProperties" in node ? node.componentProperties : null
  };
}

function inferDesignSystemInstructions(colors, typography, radii, spacing, components, instances) {
  return {
    colorRule: "Use the most frequent extracted colors as the source palette. Preserve opacity where provided.",
    typographyRule: "Use the extracted typography entries as the type scale. Do not substitute unrelated fonts or sizes.",
    spacingRule: "Use repeated gap/padding values as spacing tokens.",
    radiusRule: "Use repeated corner radii as radius tokens.",
    componentRule: components.length || instances.length
      ? "Base generated components on the extracted component/instance inventory and names."
      : "No components were detected in the selected context; derive components only from repeated structures in the node tree.",
    warning: "If the requested design system does not visually match the selected reference, stop and ask for a more specific selected frame or component rather than inventing a new system."
  };
}

function truncateString(value, maxLength) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength - 3) + "...";
}

async function collectVariableDefs(nodes) {
  const localVariables = await getLocalVariablesCompat();
  const localVariableCollections = await getLocalVariableCollectionsCompat();
  const localStyles = getLocalStylesCompat();
  const boundVariableRefs = [];

  for (const node of flattenNodes(nodes)) {
    if (node.boundVariables) {
      boundVariableRefs.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        boundVariables: node.boundVariables
      });
    }
  }

  return {
    variables: localVariables.map((variable) => ({
      id: variable.id,
      key: variable.key,
      name: variable.name,
      resolvedType: variable.resolvedType,
      scopes: variable.scopes,
      valuesByMode: variable.valuesByMode
    })),
    collections: localVariableCollections.map((collection) => ({
      id: collection.id,
      key: collection.key,
      name: collection.name,
      modes: collection.modes,
      variableIds: collection.variableIds
    })),
    styles: localStyles,
    boundVariableRefs
  };
}

async function getLocalVariablesCompat() {
  if (!figma.variables) return [];
  if (typeof figma.variables.getLocalVariablesAsync === "function") {
    return await figma.variables.getLocalVariablesAsync();
  }
  if (typeof figma.variables.getLocalVariables === "function") {
    return figma.variables.getLocalVariables();
  }
  return [];
}

async function getLocalVariableCollectionsCompat() {
  if (!figma.variables) return [];
  if (typeof figma.variables.getLocalVariableCollectionsAsync === "function") {
    return await figma.variables.getLocalVariableCollectionsAsync();
  }
  if (typeof figma.variables.getLocalVariableCollections === "function") {
    return figma.variables.getLocalVariableCollections();
  }
  return [];
}

function getLocalStylesCompat() {
  const styles = [];
  const groups = [
    ["paint", "getLocalPaintStyles"],
    ["text", "getLocalTextStyles"],
    ["effect", "getLocalEffectStyles"],
    ["grid", "getLocalGridStyles"]
  ];

  for (const [type, fn] of groups) {
    if (typeof figma[fn] === "function") {
      for (const style of figma[fn]()) {
        styles.push({
          type,
          id: style.id,
          key: style.key,
          name: style.name,
          description: style.description
        });
      }
    }
  }

  return styles;
}

async function searchLocalDesignSystem(msg) {
  const query = (msg.query || "").toLowerCase();
  const includeComponents = msg.includeComponents !== false;
  const includeVariables = msg.includeVariables !== false;
  const includeStyles = msg.includeStyles !== false;
  const results = {
    components: [],
    variables: [],
    styles: []
  };

  if (includeComponents) {
    for (const page of figma.root.children) {
      const matches = page.findAll((node) =>
        (node.type === "COMPONENT" || node.type === "COMPONENT_SET") &&
        node.name.toLowerCase().includes(query)
      );
      for (const node of matches) {
        results.components.push({
          id: node.id,
          key: node.key,
          name: node.name,
          type: node.type,
          pageName: page.name,
          description: node.description
        });
      }
    }
  }

  if (includeVariables) {
    for (const variable of await getLocalVariablesCompat()) {
      if (variable.name.toLowerCase().includes(query)) {
        results.variables.push({
          id: variable.id,
          key: variable.key,
          name: variable.name,
          resolvedType: variable.resolvedType,
          scopes: variable.scopes
        });
      }
    }
  }

  if (includeStyles) {
    for (const style of getLocalStylesCompat()) {
      if (style.name.toLowerCase().includes(query)) {
        results.styles.push(style);
      }
    }
  }

  return results;
}

async function getCodeConnectCandidates(nodes) {
  const candidates = [];

  for (const node of flattenNodes(nodes)) {
    if (node.type !== "INSTANCE") continue;

    let mainComponent = null;
    try {
      if (typeof node.getMainComponentAsync === "function") {
        mainComponent = await node.getMainComponentAsync();
      } else {
        mainComponent = node.mainComponent;
      }
    } catch (error) {
      mainComponent = null;
    }

    candidates.push({
      nodeId: node.id,
      nodeName: node.name,
      componentName: mainComponent ? mainComponent.name : node.name,
      mainComponentId: mainComponent ? mainComponent.id : null,
      mainComponentKey: mainComponent ? mainComponent.key : null
    });
  }

  return candidates;
}

async function createLocalDiagram(name, mermaidSyntax) {
  if (figma.editorType === "figjam" && typeof figma.createSticky === "function") {
    const section = typeof figma.createSection === "function" ? figma.createSection() : null;
    if (section) {
      section.name = name;
      section.x = 0;
      section.y = 0;
      if (typeof section.resizeWithoutConstraints === "function") {
        section.resizeWithoutConstraints(900, 520);
      }
      figma.currentPage.appendChild(section);
    }

    const lines = mermaidSyntax.split(/\r?\n/).filter((line) => line.trim()).slice(0, 12);
    let x = 40;
    let y = 70;
    for (const line of lines) {
      const sticky = figma.createSticky();
      sticky.x = x;
      sticky.y = y;
      sticky.text.characters = line.trim();
      figma.currentPage.appendChild(sticky);
      x += 220;
      if (x > 720) {
        x = 40;
        y += 180;
      }
    }

    return {
      message: "Created editable FigJam stickies from Mermaid lines",
      createdNodeIds: figma.currentPage.selection.map((node) => node.id)
    };
  }

  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  const frame = figma.createFrame();
  frame.name = name;
  frame.x = 0;
  frame.y = 0;
  frame.resize(960, 640);
  frame.fills = [{ type: "SOLID", color: hexToRgb("#FFFFFF") }];
  frame.layoutMode = "VERTICAL";
  frame.paddingLeft = frame.paddingRight = 32;
  frame.paddingTop = frame.paddingBottom = 32;
  frame.itemSpacing = 20;

  const title = figma.createText();
  title.fontName = { family: "Inter", style: "Bold" };
  title.fontSize = 28;
  title.characters = name;
  title.fills = [{ type: "SOLID", color: hexToRgb("#111111") }];
  frame.appendChild(title);

  const code = figma.createText();
  code.fontName = { family: "Inter", style: "Regular" };
  code.fontSize = 15;
  code.characters = mermaidSyntax;
  code.resize(880, 500);
  code.textAutoResize = "HEIGHT";
  code.fills = [{ type: "SOLID", color: hexToRgb("#333333") }];
  frame.appendChild(code);

  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
  return {
    message: "Created a local diagram source frame from Mermaid syntax",
    createdNodeIds: [frame.id],
    nodeId: frame.id
  };
}

async function createDesignFromHtml(msg) {
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  const frame = figma.createFrame();
  frame.name = msg.fileName || msg.url || "Generated Figma Design";
  frame.x = 0;
  frame.y = 0;
  frame.resize(1440, 900);
  frame.fills = [{ type: "SOLID", color: hexToRgb("#FFFFFF") }];
  frame.layoutMode = "VERTICAL";
  frame.paddingLeft = frame.paddingRight = 64;
  frame.paddingTop = frame.paddingBottom = 48;
  frame.itemSpacing = 20;

  const title = figma.createText();
  title.fontName = { family: "Inter", style: "Bold" };
  title.fontSize = 32;
  title.characters = msg.url ? `Captured from ${msg.url}` : "Generated from HTML";
  title.fills = [{ type: "SOLID", color: hexToRgb("#111111") }];
  frame.appendChild(title);

  const blocks = extractHtmlTextBlocks(msg.html || "").slice(0, 20);
  for (const block of blocks) {
    const text = figma.createText();
    text.fontName = { family: "Inter", style: "Regular" };
    text.fontSize = block.length > 80 ? 16 : 20;
    text.characters = block;
    text.resize(900, 40);
    text.textAutoResize = "HEIGHT";
    text.fills = [{ type: "SOLID", color: hexToRgb("#333333") }];
    frame.appendChild(text);
  }

  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
  return {
    message: "Created simple editable layers from fetched HTML text",
    nodeId: frame.id,
    createdNodeIds: [frame.id],
    textBlockCount: blocks.length
  };
}

function extractHtmlTextBlocks(html) {
  if (!html) return ["No HTML was provided."];
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(h1|h2|h3|p|li|button|a|label|span|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

async function exportNodePng(node, scale) {
  const bytes = await node.exportAsync({
    format: "PNG",
    constraint: { type: "SCALE", value: scale || 1 }
  });
  return `data:image/png;base64,${figma.base64Encode(bytes)}`;
}

function flattenNodes(nodes) {
  const result = [];
  for (const node of nodes) {
    result.push(node);
    if ("children" in node) {
      const childNodes = flattenNodes(Array.from(node.children));
      for (const childNode of childNodes) {
        result.push(childNode);
      }
    }
  }
  return result;
}

function mergeObjects(base, extra) {
  const result = {};
  for (const key in base) {
    if (base.hasOwnProperty(key)) result[key] = base[key];
  }
  for (const key in extra) {
    if (extra.hasOwnProperty(key)) result[key] = extra[key];
  }
  return result;
}

function createMcpHelpers() {
  var helperRequestId = activeRequestId;
  return {
    createAutoLayout: function(direction, props) {
      return createAutoLayoutFrame(direction, props);
    },
    query: function(node, selector) {
      return queryHelper.call(node, selector);
    },
    set: function(node, props) {
      return setHelper.call(node, props);
    },
    screenshot: async function(node, opts) {
      return await screenshotHelper.call(node, opts);
    },
    shouldStop: function() {
      return isRequestStopped(helperRequestId);
    },
    throwIfStopped: function() {
      throwIfRequestStopped(helperRequestId);
    }
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function rgbToHex(color) {
  const r = Math.round((color.r || 0) * 255).toString(16).padStart(2, "0");
  const g = Math.round((color.g || 0) * 255).toString(16).padStart(2, "0");
  const b = Math.round((color.b || 0) * 255).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}
