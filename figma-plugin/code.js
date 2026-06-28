// =============================================================================
// Free Figma MCP Bridge — Plugin Sandbox (code.js)
// Receives commands from ui.html (which relays from the MCP WebSocket server)
// and executes them via the Figma Plugin API.
// =============================================================================

figma.showUI(__html__, { width: 340, height: 380, title: "Free Figma MCP" });

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
      case "get_capabilities": {
        respond({
          ok: true,
          source: "local-plugin",
          apiVersion: ("apiVersion" in figma) ? figma.apiVersion : null,
          editorType: figma.editorType,
          capabilities: detectCapabilities(),
          probedAt: Date.now()
        });
        break;
      }

      // -----------------------------------------------------------------------
      case "introspect_api": {
        respond({ ok: true, source: "local-plugin", introspection: introspectApi() });
        break;
      }

      // -----------------------------------------------------------------------
      case "probe_schema": {
        respond(probeSchema(msg.spec || msg));
        break;
      }

      // -----------------------------------------------------------------------
      case "get_motion_context": {
        var motionNodes = await getTargetNodes(msg);
        var motionNode = null;
        for (var mi = 0; mi < motionNodes.length; mi++) {
          if (motionNodes[mi].type !== "PAGE") { motionNode = motionNodes[mi]; break; }
        }
        if (!motionNode) motionNode = motionNodes[0];
        respond({ ok: true, source: "local-plugin", motion: getMotionContext(motionNode) });
        break;
      }

      // -----------------------------------------------------------------------
      case "get_slot_context": {
        var slotNodes = await getTargetNodes(msg);
        var slotNode = null;
        for (var si = 0; si < slotNodes.length; si++) {
          if (slotNodes[si].type !== "PAGE") { slotNode = slotNodes[si]; break; }
        }
        if (!slotNode) slotNode = slotNodes[0];
        respond({ ok: true, source: "local-plugin", slotContext: getSlotContext(slotNode) });
        break;
      }

      // -----------------------------------------------------------------------
      case "set_slot_content": {
        respond(await setSlotContent(msg));
        break;
      }

      // -----------------------------------------------------------------------
      case "get_shader_context": {
        var shaderNodes = await getTargetNodes(msg);
        var shaderNode = null;
        for (var shi = 0; shi < shaderNodes.length; shi++) {
          if (shaderNodes[shi].type !== "PAGE") { shaderNode = shaderNodes[shi]; break; }
        }
        if (!shaderNode) shaderNode = shaderNodes[0];
        var shaderCtx = getShaderContext(shaderNode);
        try {
          var avail = await figma.listAvailableShaders();
          shaderCtx.availableShaders = Array.isArray(avail) ? JSON.parse(JSON.stringify(avail)) : [];
        } catch (e) {
          shaderCtx.warnings.push("listAvailableShaders failed: " + e.message);
        }
        shaderCtx.supported = true;
        if (!shaderCtx.shaderFills.length && !shaderCtx.availableShaders.length) {
          shaderCtx.degraded = true;
          shaderCtx.warnings.push("No SHADER fills on node and no shaders available in file. Shaders are paints of type 'SHADER' referencing a shader id; GLSL source is not exposed by the Plugin API.");
        }
        respond({ ok: true, source: "local-plugin", shaderContext: shaderCtx });
        break;
      }

      // -----------------------------------------------------------------------
      case "bake_preset": {
        var bakeNodes = await getTargetNodes(msg);
        var bakeNode = null;
        for (var bi = 0; bi < bakeNodes.length; bi++) {
          if (bakeNodes[bi].type !== "PAGE") { bakeNode = bakeNodes[bi]; break; }
        }
        if (!bakeNode) bakeNode = bakeNodes[0];
        respond({ ok: true, source: "local-plugin", capture: getResolvedAnimations(bakeNode) });
        break;
      }

      // -----------------------------------------------------------------------
      case "apply_motion": {
        var amNode = msg.nodeId ? await getNodeByIdCompat(msg.nodeId) : (figma.currentPage.selection[0] || null);
        if (!amNode) { respond({ ok: false, error: "No target node (provide nodeId or select a node)." }); break; }
        var amResult = applyMotionTracks(amNode, msg.payloads || []);
        // Honor loop intent (cycle presets only make sense looping).
        if (typeof msg.loop === "boolean") {
          try {
            var ps = amNode.playbackSettings || {};
            amNode.playbackSettings = { autoplay: ps.autoplay !== false, loop: msg.loop, muted: !!ps.muted };
          } catch (e) {
            amResult.errors.push({ field: "playbackSettings.loop", error: String(e.message || e) });
          }
        }
        respond({ ok: amResult.errors.length === 0, source: "local-plugin", nodeId: amNode.id, applied: amResult.applied, errors: amResult.errors, loop: msg.loop, mutatedNodeIds: [amNode.id] });
        break;
      }

      // -----------------------------------------------------------------------
      case "replicate_scene": {
        respond(await replicateScene(msg.plan));
        break;
      }

      // -----------------------------------------------------------------------
      case "text_typewriter": {
        respond(await textTypewriter(msg));
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
        page.name = msg.fileName || "New Free Figma MCP page";
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
          // BYPASS: Use indirect eval to avoid AsyncFunction constructor restriction
          var fn = (function() {
            return eval('(async function(figma, mcp) { ' + msg.code + ' })');
          })();
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

// Wraps a probe so a missing or throwing Plugin API surface yields `false`
// instead of crashing capability detection.
function probe(fn) {
  try {
    return !!fn();
  } catch (e) {
    return false;
  }
}

// Detects which Config 2026 Plugin API surfaces exist in the connected build.
// Pure read: creates one throwaway frame to inspect node-level properties, then
// removes it. Every leaf is a strict boolean; never throws.
function detectCapabilities() {
  var sample = null;
  try {
    sample = figma.createFrame();
  } catch (e) {
    sample = null;
  }

  var caps = {
    motion: {
      // Confirmed live in Config 2026 builds: prototype reactions + the Motion API.
      reactions:       probe(function () { return sample && "reactions" in sample; }),
      animationStyles: probe(function () { return sample && typeof sample.applyAnimationStyle === "function"; }),
      manualKeyframes: probe(function () { return sample && typeof sample.applyManualKeyframeTrack === "function"; }),
      presets:         probe(function () { return figma.motion && typeof figma.motion.figmaAnimationStyles === "function"; })
    },
    shaders: {
      list:   probe(function () { return typeof figma.listAvailableShaders === "function"; }),
      import: probe(function () { return typeof figma.importShaderById === "function"; })
    },
    codeLayers: {
      // No native code-layer node type in the Plugin API; JSX->node is the closest primitive.
      jsx: probe(function () { return typeof figma.createNodeFromJSXAsync === "function"; })
    },
    slots: {
      // Slots live on COMPONENT nodes (component.createSlot), not on the figma global.
      create: probe(function () {
        var c = null, ok = false;
        try { c = figma.createComponent(); ok = typeof c.createSlot === "function"; } catch (e) { ok = false; }
        if (c) { try { c.remove(); } catch (e) {} }
        return ok;
      })
    },
    weave: {
      read: probe(function () { return typeof figma.weave !== "undefined"; })
    }
  };

  if (sample) {
    try { sample.remove(); } catch (e) {}
  }
  return caps;
}

// Deep recon of the live Plugin API surface. Enumerates the figma global, probes
// candidate Config 2026 factory functions, and reports which node properties
// actually exist on a sample of each major node type. Bounded + side-effect-free
// (created sample nodes are removed). This is how we discover newly-shipped /
// undocumented APIs instead of guessing their names.
function describeValue(obj, key) {
  var entry = { name: key };
  try {
    entry.type = typeof obj[key];
  } catch (e) {
    entry.type = "error";
    return entry;
  }
  if (entry.type === "function") {
    try { entry.arity = obj[key].length; } catch (e) {}
  }
  return entry;
}

function enumerateKeys(obj) {
  var names = {};
  try { Object.keys(obj).forEach(function (k) { names[k] = true; }); } catch (e) {}
  try { Object.getOwnPropertyNames(obj).forEach(function (k) { names[k] = true; }); } catch (e) {}
  try { for (var k in obj) { names[k] = true; } } catch (e) {}
  return Object.keys(names).sort();
}

var CANDIDATE_FIGMA_MEMBERS = [
  "createFrame", "createRectangle", "createComponent", "createComponentFromNode",
  "createSlot", "createCodeLayer", "createShaderPaint", "createShaderEffect",
  "createMotion", "createKeyframe", "createAnimation", "createTimeline",
  "createNodeFromSvg", "createNodeFromJSXAsync", "createGif", "createVideoAsync",
  "weave", "codeLayers", "motion", "shaders", "ai", "agent", "skills"
];

var CANDIDATE_NODE_PROPS = [
  "reactions", "motion", "timeline", "keyframes", "animations",
  "transitionNode", "transitionDuration", "transitionEasing",
  "fills", "strokes", "effects", "shaderPaint", "shader",
  "codeLayer", "codeSource", "code", "language",
  "slot", "slotName", "isSlot", "slots",
  "componentPropertyDefinitions", "children"
];

function probeMembers(obj, candidates) {
  return candidates.map(function (name) {
    var present = false;
    var type = "absent";
    try {
      type = typeof obj[name];
      present = type !== "undefined";
    } catch (e) {
      type = "error";
    }
    var entry = { name: name, present: present, type: type };
    if (present && type === "function") {
      try { entry.arity = obj[name].length; } catch (e) {}
    }
    return entry;
  });
}

function introspectApi() {
  var globalKeys = enumerateKeys(figma).map(function (k) { return describeValue(figma, k); });
  var candidateFactories = probeMembers(figma, CANDIDATE_FIGMA_MEMBERS);

  // Deep map: full member list for each safe-to-create node type.
  var SAFE_NODE_FACTORIES = [
    "createFrame", "createRectangle", "createEllipse", "createText", "createComponent",
    "createLine", "createVector", "createSection", "createStar", "createPolygon"
  ];
  var nodeTypes = {};
  for (var i = 0; i < SAFE_NODE_FACTORIES.length; i++) {
    var fnName = SAFE_NODE_FACTORIES[i];
    try {
      var node = figma[fnName]();
      var seen = {};
      var proto = node;
      while (proto) {
        Object.getOwnPropertyNames(proto).forEach(function (k) { seen[k] = true; });
        proto = Object.getPrototypeOf(proto);
      }
      nodeTypes[node.type] = Object.keys(seen).sort();
      try { node.remove(); } catch (e) {}
    } catch (e) {
      nodeTypes[fnName] = "err:" + e.message;
    }
  }

  return {
    apiVersion: ("apiVersion" in figma) ? figma.apiVersion : null,
    editorType: figma.editorType,
    globalKeys: globalKeys,
    candidateFactories: candidateFactories,
    nodeTypes: nodeTypes,
    probedAt: Date.now()
  };
}

// Methods that must never be auto-invoked during schema probing because they
// mutate global state, navigate, or tear down the session.
var SCHEMA_PROBE_DENYLIST = {
  closePlugin: true, setCurrentPageAsync: true, saveVersionHistoryAsync: true,
  triggerUndo: true, commitUndo: true, openExternal: true, showUI: true,
  loadAllPagesAsync: true, createPage: true, createPageDivider: true
};

// Controlled error-leak: deliberately call a target method with an invalid
// argument so the API's validation error reveals its schema. Returns the raw
// error string (decoded server-side by schema-probe.js). Never calls denylisted
// methods; node probes use a throwaway node that is removed afterward.
function probeSchema(spec) {
  spec = spec || {};
  var method = spec.method;
  if (!method) return { ok: false, error: "probe_schema requires a 'method' name." };
  if (SCHEMA_PROBE_DENYLIST[method]) return { ok: false, error: "Method '" + method + "' is denylisted for probing." };

  var invalidArgs = Array.isArray(spec.invalidArgs) ? spec.invalidArgs : [{ __invalid__: true }];
  var target = null;
  var disposable = null;

  if (spec.on === "node") {
    var factory = spec.nodeFactory || "createFrame";
    if (SCHEMA_PROBE_DENYLIST[factory]) return { ok: false, error: "Factory '" + factory + "' is denylisted." };
    try { disposable = figma[factory](); target = disposable; }
    catch (e) { return { ok: false, error: "Could not create probe node: " + e.message }; }
  } else {
    target = figma;
  }

  var result;
  try {
    if (typeof target[method] !== "function") {
      result = { ok: false, error: "'" + method + "' is not a function on " + (spec.on === "node" ? "node" : "figma") + "." };
    } else {
      var ret = target[method].apply(target, invalidArgs);
      // If it did not throw, capture a short description of what came back.
      result = { ok: true, threw: false, method: method, returned: typeof ret };
    }
  } catch (err) {
    result = { ok: true, threw: true, method: method, errorString: String(err && err.message ? err.message : err) };
  }

  if (disposable) { try { disposable.remove(); } catch (e) {} }
  return result;
}

// Reads a node's motion into a serializable MotionContext: applied preset
// styles, manual keyframe tracks, derived timeline duration, and (as a
// fallback) prototype reactions. Matches the shape consumed by the server-side
// emitMotionCode generator.
function getMotionContext(node) {
  var ctx = {
    nodeId: node.id, supported: false, degraded: false, source: "none",
    presetStyles: [], keyframeTracks: {}, timelineDurationMs: null, reactions: [], warnings: []
  };

  try {
    if ("animationStyles" in node && node.animationStyles && node.animationStyles.length) {
      ctx.presetStyles = JSON.parse(JSON.stringify(node.animationStyles));
      ctx.supported = true; ctx.source = "motion";
    }
  } catch (e) {}

  try {
    if ("manualKeyframeTracks" in node && node.manualKeyframeTracks) {
      var tracks = JSON.parse(JSON.stringify(node.manualKeyframeTracks));
      if (tracks && Object.keys(tracks).length) {
        ctx.keyframeTracks = tracks;
        ctx.supported = true; ctx.source = "motion";
        var maxPos = 0;
        for (var prop in tracks) {
          var kfs = (tracks[prop] && tracks[prop].keyframes) || [];
          for (var i = 0; i < kfs.length; i++) {
            if (typeof kfs[i].timelinePosition === "number" && kfs[i].timelinePosition > maxPos) maxPos = kfs[i].timelinePosition;
          }
        }
        if (maxPos > 0) ctx.timelineDurationMs = Math.round(maxPos * 1000);
      }
    }
  } catch (e) {}

  try {
    if ("reactions" in node && node.reactions && node.reactions.length) {
      ctx.reactions = JSON.parse(JSON.stringify(node.reactions));
      if (!ctx.supported) {
        ctx.supported = true; ctx.degraded = true; ctx.source = "reactions";
        ctx.warnings.push("No Motion animation found; derived from prototype reactions.");
      }
    }
  } catch (e) {}

  if (!ctx.supported) ctx.warnings.push("No motion or prototype reactions on this node.");
  return ctx;
}

// Find SLOT nodes under a node (Config 2026 slots are SLOT-typed containers,
// created via component.createSlot()). Returns a serializable summary.
function getSlotContext(node) {
  var ctx = { nodeId: node.id, supported: false, slots: [], warnings: [] };
  try {
    var found = [];
    if (node.type === "SLOT") found.push(node);
    if (typeof node.findAll === "function") {
      node.findAll(function (n) { return n.type === "SLOT"; }).forEach(function (s) { found.push(s); });
    }
    ctx.supported = true;
    ctx.slots = found.map(function (s) {
      var children = s.children || [];
      return {
        slotNodeId: s.id,
        name: s.name,
        childCount: children.length,
        children: children.map(function (c) { return { id: c.id, type: c.type, name: c.name }; })
      };
    });
    if (!ctx.slots.length) ctx.warnings.push("No SLOT nodes found under this node.");
  } catch (e) {
    ctx.warnings.push("Slot read error: " + e.message);
  }
  return ctx;
}

// Fill a slot: either move an existing node into it (content.fromNodeId) or
// create a text child (content.text). Returns mutated node ids.
async function setSlotContent(msg) {
  var slot = await getNodeByIdCompat(msg.slotNodeId);
  if (!slot) return { ok: false, error: "Slot not found: " + msg.slotNodeId };
  if (slot.type !== "SLOT") return { ok: false, error: "Node is not a SLOT: " + msg.slotNodeId + " (type " + slot.type + ")" };

  var content = msg.content || {};
  var added = [];

  if (content.fromNodeId) {
    var src = await getNodeByIdCompat(content.fromNodeId);
    if (!src) return { ok: false, error: "Source node not found: " + content.fromNodeId };
    slot.appendChild(src);
    added.push(src.id);
  } else if (typeof content.text === "string") {
    var t = figma.createText();
    try { await figma.loadFontAsync(t.fontName); } catch (e) {
      try { await figma.loadFontAsync({ family: "Inter", style: "Regular" }); } catch (e2) {}
    }
    t.characters = content.text;
    slot.appendChild(t);
    added.push(t.id);
  } else {
    return { ok: false, error: "content must include 'text' (string) or 'fromNodeId' (string)." };
  }

  return {
    ok: true,
    mutatedNodeIds: [slot.id].concat(added),
    slot: { id: slot.id, name: slot.name, childCount: (slot.children || []).length }
  };
}

// Reads shader usage on a node. Shaders are paints of type "SHADER" that
// reference a shader by id; the GLSL source is not exposed by the Plugin API.
// availableShaders is filled by the async handler (listAvailableShaders).
function getShaderContext(node) {
  var ctx = { nodeId: node.id, supported: false, degraded: false, shaderFills: [], availableShaders: [], warnings: [] };
  try {
    var fills = node.fills;
    if (Array.isArray(fills)) {
      ctx.shaderFills = fills
        .filter(function (p) { return p && p.type === "SHADER"; })
        .map(function (p) { return JSON.parse(JSON.stringify(p)); });
    } else {
      ctx.warnings.push("Node fills are mixed or unavailable.");
    }
  } catch (e) {
    ctx.warnings.push("Could not read fills: " + e.message);
  }
  return ctx;
}

// Capture the fully-resolved animation on a node (node.animations), which the
// server normalizes into a reusable preset.
function getResolvedAnimations(node) {
  var result = { nodeId: node.id, supported: false, animations: {}, warnings: [] };
  try {
    if ("animations" in node && node.animations) {
      var anim = JSON.parse(JSON.stringify(node.animations));
      result.animations = anim;
      result.supported = Object.keys(anim).length > 0;
      if (!result.supported) result.warnings.push("Node has no resolved animations. Apply a preset/animation first.");
    } else {
      result.warnings.push("Node does not expose animations.");
    }
  } catch (e) {
    result.warnings.push("Could not read animations: " + e.message);
  }
  return result;
}

// Replay motion onto a node from a list of { field, track } payloads
// (field = { type:"PROPERTY", name } ; track = { keyframes:[...] }).
function applyMotionTracks(node, payloads) {
  var applied = [];
  var errors = [];
  var maxT = 0;
  for (var i = 0; i < payloads.length; i++) {
    var p = payloads[i] || {};
    try {
      node.applyManualKeyframeTrack(p.field, p.track);
      applied.push(p.field && p.field.name);
      var kfs = (p.track && p.track.keyframes) || [];
      for (var m = 0; m < kfs.length; m++) { if (kfs[m].timelinePosition > maxT) maxT = kfs[m].timelinePosition; }
    } catch (e) {
      errors.push({ field: p.field && p.field.name, error: String(e.message || e) });
    }
  }
  // The default node timeline is 2s; extend it to cover the last keyframe.
  if (maxT > 2) {
    try { if (node.timelines && node.timelines[0]) node.setTimelineDuration(node.timelines[0].id, Math.round((maxT + 0.3) * 100) / 100); } catch (e) {}
  }
  return { applied: applied, errors: errors };
}

// Execute a replication plan (from convertScene): build a scene frame, create each
// element at its layout, and apply its motion payloads. Returns created ids + errors.
async function replicateScene(plan) {
  plan = plan || {};
  var canvas = plan.canvas || [1920, 1080];
  var scene = figma.createFrame();
  scene.name = "Replicated Scene";
  scene.resize(canvas[0], canvas[1]);
  scene.clipsContent = true;
  try { scene.fills = [figma.util.solidPaint(plan.background || "#000000")]; } catch (e) {}
  scene.x = Math.round(figma.viewport.center.x - canvas[0] / 2);
  scene.y = Math.round(figma.viewport.center.y - canvas[1] / 2);
  figma.currentPage.appendChild(scene);

  var created = [], errors = [];
  var els = plan.elements || [];
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    try {
      var node;
      if (el.type === "TEXT") {
        node = figma.createText();
        try { await figma.loadFontAsync(node.fontName); }
        catch (e) { try { await figma.loadFontAsync({ family: "Inter", style: "Regular" }); node.fontName = { family: "Inter", style: "Regular" }; } catch (e2) {} }
      } else if (el.type === "ELLIPSE") {
        node = figma.createEllipse();
      } else if (el.type === "FRAME") {
        node = figma.createFrame();
      } else {
        node = figma.createRectangle(); // RECTANGLE / IMAGE / VECTOR placeholder
      }
      scene.appendChild(node);

      var L = el.layout || {};
      if (el.type === "TEXT") {
        node.characters = (el.text != null ? el.text : (el.name || "Text"));
        if (L.fontSize) { try { node.fontSize = L.fontSize; } catch (e) {} }
      } else if (L.width || L.height) {
        node.resize(L.width || 100, L.height || 100);
      }
      node.x = L.x || 0;
      node.y = L.y || 0;
      if (L.fill) { try { node.fills = [figma.util.solidPaint(L.fill)]; } catch (e) {} }
      node.name = el.name || node.type;

      var res = applyMotionTracks(node, el.payloads || []);
      for (var j = 0; j < res.errors.length; j++) errors.push({ el: el.name, error: res.errors[j] });
      if (el.loop) {
        try { var ps = node.playbackSettings || {}; node.playbackSettings = { autoplay: ps.autoplay !== false, loop: true, muted: !!ps.muted }; } catch (e) {}
      }
      created.push(node.id);
    } catch (e) {
      errors.push({ el: el && el.name, error: String(e.message || e).slice(0, 160) });
    }
  }

  figma.viewport.scrollAndZoomIntoView([scene]);
  return { ok: errors.length === 0, sceneId: scene.id, created: created, errors: errors };
}

// Typewriter recipe: reveal text by animating a clip frame's WIDTH, with the
// glyph-overflow padding fix (measure absoluteRenderBounds vs absoluteBoundingBox
// so descenders/ascenders/overhang are never shaved). Sequences multiple lines:
// each types in, holds, erases; the last stays.
async function textTypewriter(msg) {
  msg = msg || {};
  var fontName, fontSize = msg.fontSize, color = msg.color;
  var sel = figma.currentPage.selection[0];
  if (msg.fontFamily) {
    fontName = { family: msg.fontFamily, style: msg.fontStyle || "Regular" };
  } else if (sel && sel.type === "TEXT") {
    fontName = (typeof sel.fontName === "symbol") ? sel.getRangeFontName(0, 1) : sel.fontName;
    if (fontSize == null) fontSize = (typeof sel.fontSize === "symbol") ? sel.getRangeFontSize(0, 1) : sel.fontSize;
    if (!color) { var sf = (typeof sel.fills === "symbol") ? sel.getRangeFills(0, 1) : sel.fills; if (Array.isArray(sf) && sf[0] && sf[0].type === "SOLID") color = sf[0].color; }
  } else {
    fontName = { family: "Inter", style: "Regular" };
  }
  if (fontSize == null) fontSize = 72;
  await figma.loadFontAsync(fontName);

  var frame = msg.canvasNodeId ? await getNodeByIdCompat(msg.canvasNodeId) : null;
  if (!frame) {
    frame = figma.createFrame();
    frame.resize(msg.canvasW || 1920, msg.canvasH || 1080);
    frame.clipsContent = true;
    frame.fills = [figma.util.solidPaint(msg.background || "#FFFFFF")];
    frame.name = "Typewriter";
    frame.x = Math.round(figma.viewport.center.x - frame.width / 2);
    frame.y = Math.round(figma.viewport.center.y - frame.height / 2);
    figma.currentPage.appendChild(frame);
  }
  var W = frame.width, H = frame.height;

  var lines = msg.lines || [];
  var revealSec = msg.revealSec != null ? msg.revealSec : 1.2;
  var holdSec = msg.holdSec != null ? msg.holdSec : 1.0;
  var eraseSec = msg.eraseSec != null ? msg.eraseSec : 0.8;
  var gapSec = msg.gapSec != null ? msg.gapSec : 0.2;
  var mode = msg.mode || "wipe";
  var lin = { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0, y1: 0, x2: 1, y2: 1 } };
  var r4 = function (n) { return Math.round(n * 1e4) / 1e4; };

  var cursor = 0, built = [], errors = [];
  for (var i = 0; i < lines.length; i++) {
    var str = lines[i];
    // measure ink overflow on a standalone visible copy
    var probe = figma.createText(); probe.fontName = fontName; probe.fontSize = fontSize; probe.characters = str;
    figma.currentPage.appendChild(probe); probe.x = 0; probe.y = 0;
    var bb = probe.absoluteBoundingBox, rb = probe.absoluteRenderBounds || bb;
    var layoutW = bb.width, layoutH = bb.height;
    var ov = { left: bb.x - rb.x, right: (rb.x + rb.width) - (bb.x + bb.width), top: bb.y - rb.y, bottom: (rb.y + rb.height) - (bb.y + bb.height) };
    probe.remove();

    var safety = Math.max(2, Math.ceil(fontSize * 0.04));
    var padL = Math.max(0, ov.left), padR = Math.max(0, ov.right), padT = Math.max(0, ov.top), padB = Math.max(0, ov.bottom);
    var clipW = Math.ceil(layoutW + padL + padR + 2 * safety);
    var clipH = Math.ceil(layoutH + padT + padB + 2 * safety);

    var t = figma.createText(); t.fontName = fontName; t.fontSize = fontSize; t.characters = str; if (color) t.fills = [{ type: "SOLID", color: color }];
    var clip = figma.createFrame(); clip.name = "TW: " + str; clip.clipsContent = true; clip.fills = []; clip.resize(clipW, clipH);
    clip.appendChild(t); t.x = padL + safety; t.y = padT + safety;
    frame.appendChild(clip);
    clip.x = Math.round((W - clipW) / 2); clip.y = Math.round((H - clipH) / 2);

    var isLast = i === lines.length - 1;
    var kfs = [{ t: cursor, v: 0 }];
    if (mode === "step") {
      var cc = Math.max(1, str.length), stepW = clipW / cc, per = revealSec / cc, eps = Math.min(0.0005, per * 0.1);
      for (var c = 1; c <= cc; c++) { kfs.push({ t: cursor + per * c - eps, v: stepW * (c - 1) }); kfs.push({ t: cursor + per * c, v: stepW * c }); }
    } else {
      kfs.push({ t: cursor + revealSec, v: clipW });
    }
    var end = cursor + revealSec;
    kfs.push({ t: end + holdSec, v: clipW }); end += holdSec;
    if (!isLast) { kfs.push({ t: end + eraseSec, v: 0 }); end += eraseSec; }

    try {
      clip.applyManualKeyframeTrack({ type: "PROPERTY", name: "WIDTH" }, { keyframes: kfs.map(function (k) { return { timelinePosition: r4(k.t), value: { type: "FLOAT", value: r4(k.v) }, easing: lin }; }) });
      if (clip.timelines && clip.timelines[0]) clip.setTimelineDuration(clip.timelines[0].id, r4(end + 0.3));
    } catch (e) { errors.push({ line: str, error: String(e.message || e).slice(0, 140) }); }

    built.push({ line: str, clipId: clip.id, clipWidth: clipW, startSec: r4(cursor), endSec: r4(end), inkOverflow: { left: Math.round(ov.left), right: Math.round(ov.right), top: Math.round(ov.top), bottom: Math.round(ov.bottom) } });
    cursor = end + (isLast ? 0 : gapSec);
  }

  figma.viewport.scrollAndZoomIntoView([frame]);
  return { ok: errors.length === 0, frameId: frame.id, font: fontName, fontSize: fontSize, mode: mode, totalSec: r4(cursor), lines: built, errors: errors };
}

function isRequestStopped(requestId) {
  return !!(requestId && stoppedRequests[requestId]);
}function throwIfRequestStopped(requestId) {
  if (isRequestStopped(requestId)) {
    throw new Error("Stopped by user from the Free Figma MCP Bridge UI.");
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
