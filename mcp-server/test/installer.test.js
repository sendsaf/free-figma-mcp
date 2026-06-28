import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  CLIENTS,
  RULES_TARGETS,
  SKILLS_TARGETS,
  GUIDANCE_MARKER_START,
  GUIDANCE_MARKER_END,
  PACKAGE_NAME,
  SERVER_NAME,
  buildServerEntry,
  clientCapabilities,
  createInstaller,
  downloadsDir,
  guidanceSnippet,
  listClients,
  mergeConfig,
  pluginInstructions,
  serializeTomlServer,
  upsertTomlServer
} from "../src/installer.js";

test("buildServerEntry node mode points at the local server.js", () => {
  const entry = buildServerEntry({ serverEntry: "/repo/mcp-server/server.js" });
  assert.deepEqual(entry, { command: "node", args: ["/repo/mcp-server/server.js"], env: {} });
});

test("buildServerEntry node mode requires a serverEntry", () => {
  assert.throws(() => buildServerEntry({ useNpx: false }), /serverEntry is required/);
});

test("buildServerEntry npx mode uses a cmd wrapper on win32", () => {
  const entry = buildServerEntry({ useNpx: true, platform: "win32" });
  assert.deepEqual(entry, { command: "cmd", args: ["/c", "npx", "-y", PACKAGE_NAME], env: {} });
});

test("buildServerEntry npx mode runs npx directly on posix", () => {
  const entry = buildServerEntry({ useNpx: true, platform: "linux" });
  assert.deepEqual(entry, { command: "npx", args: ["-y", PACKAGE_NAME], env: {} });
});

test("buildServerEntry npx wrapper differs per OS (darwin uses bare npx)", () => {
  assert.equal(buildServerEntry({ useNpx: true, platform: "darwin" }).command, "npx");
  assert.equal(buildServerEntry({ useNpx: true, platform: "win32" }).command, "cmd");
});

test("OS matrix: Claude Desktop config path per platform", () => {
  const r = CLIENTS["claude-desktop"].resolvePath;
  assert.equal(
    r({ platform: "win32", env: { APPDATA: "C:\\Users\\u\\AppData\\Roaming" }, home: "C:\\Users\\u", cwd: "/p" }),
    path.join("C:\\Users\\u\\AppData\\Roaming", "Claude", "claude_desktop_config.json")
  );
  assert.equal(
    r({ platform: "darwin", env: {}, home: "/Users/u", cwd: "/p" }),
    path.join("/Users/u", "Library", "Application Support", "Claude", "claude_desktop_config.json")
  );
  assert.equal(
    r({ platform: "linux", env: {}, home: "/home/u", cwd: "/p" }),
    path.join("/home/u", ".config", "Claude", "claude_desktop_config.json")
  );
  // XDG_CONFIG_HOME override on linux
  assert.equal(
    r({ platform: "linux", env: { XDG_CONFIG_HOME: "/cfg" }, home: "/home/u", cwd: "/p" }),
    path.join("/cfg", "Claude", "claude_desktop_config.json")
  );
  // win32 falls back to ~/AppData/Roaming when APPDATA is unset
  assert.equal(
    r({ platform: "win32", env: {}, home: "C:\\Users\\u", cwd: "/p" }),
    path.join("C:\\Users\\u", "AppData", "Roaming", "Claude", "claude_desktop_config.json")
  );
});

test("OS matrix: Qoder config path per platform", () => {
  const r = CLIENTS.qoder.resolvePath;
  assert.equal(
    r({ platform: "win32", env: { APPDATA: "C:\\Users\\u\\AppData\\Roaming" }, home: "C:\\Users\\u", cwd: "/p" }),
    path.join("C:\\Users\\u\\AppData\\Roaming", "Qoder", "SharedClientCache", "mcp.json")
  );
  assert.equal(
    r({ platform: "darwin", env: {}, home: "/Users/u", cwd: "/p" }),
    path.join("/Users/u", "Library", "Application Support", "Qoder", "SharedClientCache", "mcp.json")
  );
  assert.equal(
    r({ platform: "linux", env: {}, home: "/home/u", cwd: "/p" }),
    path.join("/home/u", ".config", "Qoder", "SharedClientCache", "mcp.json")
  );
});

test("OS matrix: home-relative clients are platform-independent", () => {
  for (const platform of ["win32", "darwin", "linux"]) {
    assert.equal(
      CLIENTS.cursor.resolvePath({ platform, env: {}, home: "/h", cwd: "/p" }),
      path.join("/h", ".cursor", "mcp.json")
    );
    assert.equal(
      CLIENTS.windsurf.resolvePath({ platform, env: {}, home: "/h", cwd: "/p" }),
      path.join("/h", ".codeium", "windsurf", "mcp_config.json")
    );
    assert.equal(
      CLIENTS.codex.resolvePath({ platform, env: {}, home: "/h", cwd: "/p" }),
      path.join("/h", ".codex", "config.toml")
    );
  }
});

test("mergeConfig adds an mcpServers entry while preserving existing servers", () => {
  const existing = { mcpServers: { other: { command: "node", args: ["x.js"] } }, unrelated: true };
  const entry = { command: "node", args: ["server.js"], env: {} };
  const merged = mergeConfig(existing, "mcpServers", SERVER_NAME, entry);
  assert.equal(merged.unrelated, true);
  assert.deepEqual(merged.mcpServers.other, { command: "node", args: ["x.js"] });
  assert.deepEqual(merged.mcpServers[SERVER_NAME], entry);
  // original object is not mutated
  assert.equal(existing.mcpServers[SERVER_NAME], undefined);
});

test("mergeConfig uses the servers key and adds stdio type for VS Code", () => {
  const entry = { command: "node", args: ["server.js"], env: {} };
  const merged = mergeConfig({}, "servers", SERVER_NAME, entry);
  assert.equal(merged.mcpServers, undefined);
  assert.deepEqual(merged.servers[SERVER_NAME], { type: "stdio", ...entry });
});

test("mergeConfig tolerates a non-object existing config", () => {
  const merged = mergeConfig(null, "mcpServers", "x", { command: "node", args: [] });
  assert.ok(merged.mcpServers.x);
});

test("CLIENTS resolve config paths from injected platform/env/home/cwd", () => {
  const cursor = CLIENTS.cursor.resolvePath({ platform: "linux", env: {}, home: "/home/u", cwd: "/proj" });
  assert.equal(cursor, path.join("/home/u", ".cursor", "mcp.json"));

  const claudeWin = CLIENTS["claude-desktop"].resolvePath({
    platform: "win32",
    env: { APPDATA: "C:\\Users\\u\\AppData\\Roaming" },
    home: "C:\\Users\\u",
    cwd: "C:\\proj"
  });
  assert.equal(claudeWin, path.join("C:\\Users\\u\\AppData\\Roaming", "Claude", "claude_desktop_config.json"));

  const vscode = CLIENTS.vscode.resolvePath({ platform: "darwin", env: {}, home: "/Users/u", cwd: "/proj" });
  assert.equal(vscode, path.join("/proj", ".vscode", "mcp.json"));

  const kiro = CLIENTS.kiro.resolvePath({ platform: "linux", env: {}, home: "/home/u", cwd: "/proj" });
  assert.equal(kiro, path.join("/proj", ".kiro", "settings", "mcp.json"));

  const qoderWin = CLIENTS.qoder.resolvePath({
    platform: "win32",
    env: { APPDATA: "C:\\Users\\u\\AppData\\Roaming" },
    home: "C:\\Users\\u",
    cwd: "C:\\proj"
  });
  assert.equal(qoderWin, path.join("C:\\Users\\u\\AppData\\Roaming", "Qoder", "SharedClientCache", "mcp.json"));
});

test("listClients returns all known clients with labels", () => {
  const clients = listClients();
  assert.equal(clients.length, Object.keys(CLIENTS).length);
  assert.ok(clients.every((c) => c.key && c.label && c.format));
});

test("pluginInstructions includes the manifest path", () => {
  const text = pluginInstructions("/repo/figma-plugin/manifest.json");
  assert.match(text, /\/repo\/figma-plugin\/manifest\.json/);
  assert.match(text, /Import plugin from manifest/);
});

// ---- createInstaller with an in-memory filesystem ----------------------------

function makeFakeFs(seed = {}) {
  const files = new Map(Object.entries(seed));
  const dirs = new Set();
  const copyCalls = [];
  return {
    files,
    dirs,
    copyCalls,
    existsSync: (p) => files.has(p),
    readFileSync: (p) => {
      if (!files.has(p)) throw new Error(`ENOENT: ${p}`);
      return files.get(p);
    },
    writeFileSync: (p, data) => files.set(p, data),
    mkdirSync: (p) => dirs.add(p),
    copyFileSync: (from, to) => {
      files.set(to, files.get(from) ?? `<copy:${from}>`);
    },
    cpSync: (src, dest, opts) => {
      copyCalls.push({ src, dest, opts });
      files.set(dest, `<dir-copy:${src}>`);
    },
    readdirSync: (dir, opts) => {
      const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
      const names = new Set();
      const childIsDir = new Map();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const seg = rest.split(/[\\/]/)[0];
        names.add(seg);
        if (/[\\/]/.test(rest)) childIsDir.set(seg, true);
      }
      const entries = [...names].map((name) => ({ name, isDirectory: () => Boolean(childIsDir.get(name)) }));
      return opts && opts.withFileTypes ? entries : entries.map((e) => e.name);
    }
  };
}

test("configureClient writes a merged config to the resolved path", () => {
  const fakeFs = makeFakeFs();
  const installer = createInstaller({
    serverEntry: "/repo/mcp-server/server.js",
    pluginDir: "/repo/figma-plugin",
    env: {},
    platform: "linux",
    home: "/home/u",
    cwd: "/proj",
    fileSystem: fakeFs
  });

  const result = installer.configureClient("cursor");
  assert.equal(result.configPath, path.join("/home/u", ".cursor", "mcp.json"));
  const written = JSON.parse(fakeFs.files.get(result.configPath));
  assert.deepEqual(written.mcpServers[SERVER_NAME], {
    command: "node",
    args: ["/repo/mcp-server/server.js"],
    env: {}
  });
});

test("configureClient preserves an existing unrelated server", () => {
  const cfgPath = path.join("/home/u", ".cursor", "mcp.json");
  const fakeFs = makeFakeFs({
    [cfgPath]: JSON.stringify({ mcpServers: { keep: { command: "node", args: ["k.js"] } } })
  });
  const installer = createInstaller({
    serverEntry: "/repo/server.js",
    pluginDir: "/repo/figma-plugin",
    env: {},
    platform: "linux",
    home: "/home/u",
    cwd: "/proj",
    fileSystem: fakeFs
  });

  installer.configureClient("cursor", { name: "free-figma-mcp" });
  const written = JSON.parse(fakeFs.files.get(cfgPath));
  assert.ok(written.mcpServers.keep);
  assert.ok(written.mcpServers["free-figma-mcp"]);
});

test("configureClient throws on invalid existing JSON", () => {
  const cfgPath = path.join("/home/u", ".cursor", "mcp.json");
  const fakeFs = makeFakeFs({ [cfgPath]: "{ not json" });
  const installer = createInstaller({
    serverEntry: "/repo/server.js",
    pluginDir: "/repo/figma-plugin",
    home: "/home/u",
    cwd: "/proj",
    platform: "linux",
    env: {},
    fileSystem: fakeFs
  });
  assert.throws(() => installer.configureClient("cursor"), /not valid JSON/);
});

test("installPlugin copies the three plugin files to a destination", () => {
  const fakeFs = makeFakeFs({
    [path.join("/repo/figma-plugin", "manifest.json")]: "{manifest}",
    [path.join("/repo/figma-plugin", "code.js")]: "// code",
    [path.join("/repo/figma-plugin", "ui.html")]: "<html>"
  });
  const installer = createInstaller({
    serverEntry: "/repo/server.js",
    pluginDir: "/repo/figma-plugin",
    fileSystem: fakeFs
  });

  const result = installer.installPlugin("/dest/plugin");
  assert.equal(result.manifestPath, path.join("/dest/plugin", "manifest.json"));
  assert.equal(result.copied.length, 3);
  assert.equal(fakeFs.files.get(path.join("/dest/plugin", "manifest.json")), "{manifest}");
});

test("downloadsDir resolves per OS and honors XDG_DOWNLOAD_DIR on linux", () => {
  assert.equal(downloadsDir({ platform: "win32", env: {}, home: "C:\\Users\\u" }), path.join("C:\\Users\\u", "Downloads"));
  assert.equal(downloadsDir({ platform: "darwin", env: {}, home: "/Users/u" }), path.join("/Users/u", "Downloads"));
  assert.equal(downloadsDir({ platform: "linux", env: {}, home: "/home/u" }), path.join("/home/u", "Downloads"));
  assert.equal(downloadsDir({ platform: "linux", env: { XDG_DOWNLOAD_DIR: "/data/dl" }, home: "/home/u" }), "/data/dl");
});

test("suggestedPluginDir is <Downloads>/free-figma-mcp-plugin", () => {
  const installer = createInstaller({
    serverEntry: "/repo/server.js",
    pluginDir: "/repo/figma-plugin",
    platform: "linux",
    env: {},
    home: "/home/u",
    fileSystem: makeFakeFs()
  });
  assert.equal(installer.suggestedPluginDir(), path.join("/home/u", "Downloads", "free-figma-mcp-plugin"));
});

// ---- Codex TOML --------------------------------------------------------------

test("codex resolves config.toml under ~/.codex (CODEX_HOME overrides)", () => {
  const def = CLIENTS.codex.resolvePath({ platform: "linux", env: {}, home: "/home/u", cwd: "/proj" });
  assert.equal(def, path.join("/home/u", ".codex", "config.toml"));
  const overridden = CLIENTS.codex.resolvePath({ platform: "linux", env: { CODEX_HOME: "/custom/codex" }, home: "/home/u", cwd: "/proj" });
  assert.equal(overridden, path.join("/custom/codex", "config.toml"));
});

test("serializeTomlServer emits a valid block and escapes Windows paths", () => {
  const block = serializeTomlServer(SERVER_NAME, {
    command: "node",
    args: ["C:\\path\\to\\server.js"],
    env: {}
  });
  assert.match(block, /^\[mcp_servers\.free-figma-mcp\]$/m);
  assert.match(block, /command = "node"/);
  assert.match(block, /args = \["C:\\\\path\\\\to\\\\server\.js"\]/);
  assert.doesNotMatch(block, /env =/); // empty env omitted
});

test("upsertTomlServer appends a new block and preserves existing content", () => {
  const existing = `[other]\nkey = "value"\n`;
  const out = upsertTomlServer(existing, SERVER_NAME, { command: "node", args: ["s.js"], env: {} });
  assert.match(out, /\[other\]/);
  assert.match(out, /key = "value"/);
  assert.match(out, /\[mcp_servers\.free-figma-mcp\]/);
  assert.ok(out.endsWith("\n"));
});

test("upsertTomlServer replaces an existing block in place without touching neighbors", () => {
  const existing = [
    `[mcp_servers.free-figma-mcp]`,
    `command = "old"`,
    `args = ["old.js"]`,
    ``,
    `[mcp_servers.keep]`,
    `command = "node"`,
    `args = ["keep.js"]`,
    ``
  ].join("\n");
  const out = upsertTomlServer(existing, SERVER_NAME, { command: "node", args: ["new.js"], env: {} });
  assert.match(out, /args = \["new\.js"\]/);
  assert.doesNotMatch(out, /old\.js/);
  assert.match(out, /\[mcp_servers\.keep\]/);
  assert.match(out, /keep\.js/);
});

test("configureClient writes TOML for the codex client", () => {
  const cfgPath = path.join("/home/u", ".codex", "config.toml");
  const fakeFs = makeFakeFs({ [cfgPath]: `[history]\npersistence = "save-all"\n` });
  const installer = createInstaller({
    serverEntry: "/repo/mcp-server/server.js",
    pluginDir: "/repo/figma-plugin",
    env: {},
    platform: "linux",
    home: "/home/u",
    cwd: "/proj",
    fileSystem: fakeFs
  });
  const result = installer.configureClient("codex");
  assert.equal(result.format, "toml");
  const written = fakeFs.files.get(cfgPath);
  assert.match(written, /\[history\]/); // preserved
  assert.match(written, /\[mcp_servers\.free-figma-mcp\]/);
  assert.match(written, /args = \["\/repo\/mcp-server\/server\.js"\]/);
});

// ---- Capabilities ------------------------------------------------------------

test("clientCapabilities distinguishes skills vs rules and their scopes", () => {
  const cc = clientCapabilities("claude-code");
  assert.deepEqual(cc.skills.scopes, ["project", "global"]);
  assert.ok(cc.rules.supported);

  const qoder = clientCapabilities("qoder");
  assert.equal(qoder.skills.supported, false);
  assert.deepEqual(qoder.rules.scopes, ["project"]);

  const codex = clientCapabilities("codex");
  assert.equal(codex.skills.supported, false);
  assert.deepEqual(codex.rules.scopes, ["project", "global"]);

  const claudeDesktop = clientCapabilities("claude-desktop");
  assert.deepEqual(claudeDesktop.skills.scopes, ["global"]);
  assert.equal(claudeDesktop.rules.supported, false);
});

test("guidanceSnippet is wrapped in stable markers", () => {
  const snippet = guidanceSnippet();
  assert.ok(snippet.startsWith(GUIDANCE_MARKER_START));
  assert.ok(snippet.trimEnd().endsWith(GUIDANCE_MARKER_END));
  assert.match(snippet, /use_figma/);
});

// ---- installSkills (Agent Skills, folder copy) -------------------------------

function seedSkills() {
  return makeFakeFs({
    [path.join("/repo/skills", "figma-motion", "SKILL.md")]: "# motion skill",
    [path.join("/repo/skills", "figma-slots", "SKILL.md")]: "# slots skill",
    [path.join("/repo/skills", "figma-motion", "references", "api.md")]: "# refs"
  });
}

const SKILLS_ROOT = path.join("/repo", "skills");

function skillsInstaller(fakeFs) {
  return createInstaller({
    serverEntry: "/repo/server.js",
    pluginDir: "/repo/figma-plugin",
    skillsDir: SKILLS_ROOT,
    home: "/home/u",
    cwd: "/proj",
    env: {},
    fileSystem: fakeFs
  });
}

test("installSkills copies skill folders for Claude Code at project scope", () => {
  const fakeFs = seedSkills();
  const result = skillsInstaller(fakeFs).installSkills("claude-code", { scope: "project" });
  assert.equal(result.type, "skills");
  assert.equal(result.scope, "project");
  assert.equal(result.destDir, path.join("/proj", ".claude", "skills"));
  assert.deepEqual(result.skills.sort(), ["figma-motion", "figma-slots"]);
  assert.equal(fakeFs.copyCalls.length, 2);
  const motion = fakeFs.copyCalls.find((c) => c.src === path.join(SKILLS_ROOT, "figma-motion"));
  assert.equal(motion.dest, path.join("/proj", ".claude", "skills", "figma-motion"));
  assert.equal(motion.opts.recursive, true);
});

test("installSkills global scope targets ~/.claude/skills", () => {
  const fakeFs = seedSkills();
  const result = skillsInstaller(fakeFs).installSkills("claude-code", { scope: "global" });
  assert.equal(result.destDir, path.join("/home/u", ".claude", "skills"));
});

test("installSkills is skipped for rule-only clients (Qoder), pointing to rules", () => {
  const result = skillsInstaller(seedSkills()).installSkills("qoder");
  assert.equal(result.skipped, true);
  assert.match(result.reason, /rules|MCP/i);
});

test("installSkills reports unsupported scope clearly", () => {
  // claude-desktop only supports global skills, not project
  const result = skillsInstaller(seedSkills()).installSkills("claude-desktop", { scope: "project" });
  assert.equal(result.skipped, true);
  assert.match(result.reason, /global/);
});

// ---- installRules (client-native rules, different from skills) ---------------

test("installRules writes one rule doc per skill for dir clients (Qoder)", () => {
  const fakeFs = seedSkills();
  const result = skillsInstaller(fakeFs).installRules("qoder", { scope: "project" });
  assert.equal(result.type, "rules");
  assert.equal(result.kind, "dir");
  assert.equal(result.destDir, path.join("/proj", ".qoder", "rules"));
  assert.deepEqual(result.rules.sort(), ["figma-motion", "figma-slots"]);
  assert.equal(fakeFs.files.get(path.join("/proj", ".qoder", "rules", "figma-motion.md")), "# motion skill");
});

test("installRules merges a guidance section into a file client (Codex AGENTS.md)", () => {
  const agents = path.join("/proj", "AGENTS.md");
  const fakeFs = makeFakeFs({ [agents]: "# Project\n\nExisting notes.\n" });
  const installer = skillsInstaller(fakeFs);
  const first = installer.installRules("codex", { scope: "project" });
  assert.equal(first.kind, "file");
  assert.equal(first.action, "appended");
  let content = fakeFs.files.get(agents);
  assert.match(content, /Existing notes\./);
  assert.match(content, /Free Figma MCP/);
  // idempotent: re-running updates in place
  const second = installer.installRules("codex", { scope: "project" });
  assert.equal(second.action, "updated");
  content = fakeFs.files.get(agents);
  assert.equal(content.split(GUIDANCE_MARKER_START).length - 1, 1);
});

test("installRules global scope for Codex targets ~/.codex/AGENTS.md", () => {
  const fakeFs = seedSkills();
  const result = skillsInstaller(fakeFs).installRules("codex", { scope: "global" });
  assert.equal(result.filePath, path.join("/home/u", ".codex", "AGENTS.md"));
});

test("installRules global scope for Windsurf targets the global_rules file", () => {
  const fakeFs = seedSkills();
  const result = skillsInstaller(fakeFs).installRules("windsurf", { scope: "global" });
  assert.equal(result.kind, "file");
  assert.equal(result.filePath, path.join("/home/u", ".codeium", "windsurf", "memories", "global_rules.md"));
});

test("installRules reports unsupported scope (Qoder has no global rules)", () => {
  const result = skillsInstaller(seedSkills()).installRules("qoder", { scope: "global" });
  assert.equal(result.skipped, true);
  assert.match(result.reason, /project/);
});

test("installRules is skipped for clients with no rules store (Claude Desktop)", () => {
  const result = skillsInstaller(seedSkills()).installRules("claude-desktop");
  assert.equal(result.skipped, true);
  assert.equal(RULES_TARGETS["claude-desktop"], null);
});
