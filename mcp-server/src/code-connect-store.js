import fs from "node:fs";

export function createCodeConnectStore({ localDataDir, mappingsPath }) {
  function readMappings() {
    try {
      return JSON.parse(fs.readFileSync(mappingsPath, "utf8"));
    } catch {
      return {};
    }
  }

  function writeMappings(mappings) {
    fs.mkdirSync(localDataDir, { recursive: true });
    fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));
  }

  function saveMapping(mapping) {
    const mappings = readMappings();
    mappings[mapping.nodeId] = {
      componentName: mapping.componentName,
      source: mapping.source,
      label: mapping.label || "React",
      snippet: mapping.snippet,
      snippetImports: mapping.snippetImports,
      snippetNestedFunctions: mapping.snippetNestedFunctions,
      version: "local-json"
    };
    writeMappings(mappings);
    return mappings[mapping.nodeId];
  }

  return {
    mappingsPath,
    readMappings,
    writeMappings,
    saveMapping
  };
}
