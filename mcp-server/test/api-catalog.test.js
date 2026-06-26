import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCatalog, diffCatalogs } from "../src/api-catalog.js";

function mockSendToFigma(responses) {
  return async (cmd) => {
    if (cmd.type === "introspect_api") return responses.introspection;
    if (cmd.type === "probe_schema") return responses.probe(cmd.spec);
    throw new Error("unexpected command " + cmd.type);
  };
}

test("buildCatalog: assembles surface + decoded schemas", async () => {
  const sendToFigma = mockSendToFigma({
    introspection: {
      introspection: {
        apiVersion: "1.0.0",
        editorType: "figma",
        globalKeys: [{ name: "createFrame", type: "function" }, { name: "motion", type: "object" }],
        nodeTypes: { FRAME: ["applyAnimationStyle", "applyManualKeyframeTrack"] }
      }
    },
    probe: (spec) => {
      if (spec.method === "applyAnimationStyle") {
        return { ok: true, threw: true, method: "applyAnimationStyle", errorString: 'in applyAnimationStyle: Property "styleId" failed validation: Expected string, received object' };
      }
      return { ok: true, threw: false, returned: "object" };
    }
  });

  const catalog = await buildCatalog({ sendToFigma, probes: [
    { key: "applyAnimationStyle", on: "node", method: "applyAnimationStyle", invalidArgs: [{}] },
    { key: "noThrow", on: "figma", method: "createImageAsync", invalidArgs: [1] }
  ]});

  assert.equal(catalog.apiVersion, "1.0.0");
  assert.equal(catalog.editorType, "figma");
  assert.equal(catalog.globalKeys.length, 2);
  assert.ok(catalog.nodeTypes.FRAME.includes("applyAnimationStyle"));
  assert.equal(catalog.schemas.applyAnimationStyle.method, "applyAnimationStyle");
  assert.ok(catalog.schemas.applyAnimationStyle.constraints.some((c) => c.kind === "type" && c.expected === "string"));
  assert.match(catalog.schemas.noThrow.note, /did not throw/);
  assert.ok(typeof catalog.capturedAt === "string");
});

test("buildCatalog: tolerates introspection returned without wrapper", async () => {
  const sendToFigma = mockSendToFigma({
    introspection: { apiVersion: "1.0.0", editorType: "figma", globalKeys: [], nodeTypes: {} },
    probe: () => ({ ok: true, threw: false, returned: "object" })
  });
  const catalog = await buildCatalog({ sendToFigma, probes: [] });
  assert.equal(catalog.apiVersion, "1.0.0");
  assert.deepEqual(catalog.schemas, {});
});

test("diffCatalogs: reports added/removed globals and node types", () => {
  const prev = { globalKeys: [{ name: "createFrame" }, { name: "createOld" }], nodeTypes: { FRAME: [], OLDTYPE: [] } };
  const next = { globalKeys: [{ name: "createFrame" }, { name: "createNew" }], nodeTypes: { FRAME: [], NEWTYPE: [] } };
  const diff = diffCatalogs(prev, next);
  assert.deepEqual(diff.addedGlobals, ["createNew"]);
  assert.deepEqual(diff.removedGlobals, ["createOld"]);
  assert.deepEqual(diff.addedNodeTypes, ["NEWTYPE"]);
  assert.deepEqual(diff.removedNodeTypes, ["OLDTYPE"]);
});

test("diffCatalogs: handles null previous catalog (first run)", () => {
  const next = { globalKeys: [{ name: "createFrame" }], nodeTypes: { FRAME: [] } };
  const diff = diffCatalogs(null, next);
  assert.deepEqual(diff.addedGlobals, ["createFrame"]);
  assert.deepEqual(diff.removedGlobals, []);
});
