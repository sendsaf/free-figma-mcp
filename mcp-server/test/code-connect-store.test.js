import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createCodeConnectStore } from "../src/code-connect-store.js";

test("code connect store persists mappings as local JSON", () => {
  const localDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-local-mcp-"));
  const mappingsPath = path.join(localDataDir, "code-connect-mappings.json");
  const store = createCodeConnectStore({ localDataDir, mappingsPath });

  const saved = store.saveMapping({
    nodeId: "1:2",
    componentName: "Button",
    source: "src/components/Button.tsx",
    label: "React"
  });

  assert.equal(saved.componentName, "Button");
  assert.equal(saved.source, "src/components/Button.tsx");
  assert.equal(saved.version, "local-json");
  const persisted = store.readMappings()["1:2"];
  assert.equal(persisted.componentName, "Button");
  assert.equal(persisted.source, "src/components/Button.tsx");
  assert.equal(persisted.label, "React");
  assert.equal(persisted.version, "local-json");
});
