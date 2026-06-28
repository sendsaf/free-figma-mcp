// =============================================================================
// Free Figma MCP installer
//
// Pure, injectable helpers for wiring the MCP server into an IDE/client config
// and for copying the Figma plugin files to a chosen location. All filesystem
// and environment access is injected so the logic is unit-testable.
// =============================================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SERVER_NAME = "free-figma-mcp";
export const PACKAGE_NAME = "free-figma-mcp";

// Supported MCP clients. Each entry resolves its config file location from the
// running platform/env/home/cwd, and declares which top-level key it uses
// (`mcpServers` for most clients, `servers` for VS Code).
export const CLIENTS = {
  "claude-desktop": {
    label: "Claude Desktop",
    format: "mcpServers",
    scope: "user",
    resolvePath: ({ platform, env, home }) => {
      if (platform === "win32") {
        const appData = env.APPDATA || path.join(home, "AppData", "Roaming");
        return path.join(appData, "Claude", "claude_desktop_config.json");
      }
      if (platform === "darwin") {
        return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
      }
      const xdg = env.XDG_CONFIG_HOME || path.join(home, ".config");
      return path.join(xdg, "Claude", "claude_desktop_config.json");
    }
  },
  "claude-code": {
    label: "Claude Code (project .mcp.json)",
    format: "mcpServers",
    scope: "project",
    resolvePath: ({ cwd }) => path.join(cwd, ".mcp.json")
  },
  cursor: {
    label: "Cursor",
    format: "mcpServers",
    scope: "user",
    resolvePath: ({ home }) => path.join(home, ".cursor", "mcp.json")
  },
  vscode: {
    label: "VS Code (workspace .vscode/mcp.json)",
    format: "servers",
    scope: "project",
    resolvePath: ({ cwd }) => path.join(cwd, ".vscode", "mcp.json")
  },
  windsurf: {
    label: "Windsurf",
    format: "mcpServers",
    scope: "user",
    resolvePath: ({ home }) => path.join(home, ".codeium", "windsurf", "mcp_config.json")
  },
  codex: {
    label: "Codex CLI (~/.codex/config.toml)",
    format: "toml",
    scope: "user",
    resolvePath: ({ env, home }) => {
      const base = env.CODEX_HOME || path.join(home, ".codex");
      return path.join(base, "config.toml");
    }
  },
  kiro: {
    label: "Kiro (workspace .kiro/settings/mcp.json)",
    format: "mcpServers",
    scope: "project",
    resolvePath: ({ cwd }) => path.join(cwd, ".kiro", "settings", "mcp.json")
  },
  qoder: {
    label: "Qoder IDE",
    format: "mcpServers",
    scope: "user",
    resolvePath: ({ platform, env, home }) => {
      if (platform === "win32") {
        const appData = env.APPDATA || path.join(home, "AppData", "Roaming");
        return path.join(appData, "Qoder", "SharedClientCache", "mcp.json");
      }
      if (platform === "darwin") {
        return path.join(home, "Library", "Application Support", "Qoder", "SharedClientCache", "mcp.json");
      }
      const xdg = env.XDG_CONFIG_HOME || path.join(home, ".config");
      return path.join(xdg, "Qoder", "SharedClientCache", "mcp.json");
    }
  }
};

// =============================================================================
// Skills vs rules — two DIFFERENT things, installed differently:
//
//   SKILLS  = Agent Skills: model-invoked SKILL.md folders (+ references/).
//             A Claude ecosystem concept. We copy the folders verbatim.
//   RULES   = a client's native always-on / triggered instruction system
//             (Cursor rules, Kiro steering, Codex/Claude AGENTS|CLAUDE.md,
//             VS Code copilot-instructions, Windsurf rules/global_rules).
//             We derive rule docs from the same skills.
//
// Each is also scoped: "project" (this workspace) vs "global" (all projects).
// We only advertise "global" where the client has a real global location.
// =============================================================================

// Clients with a genuine Agent Skills store (folder copy of SKILL.md trees).
export const SKILLS_TARGETS = {
  "claude-code": {
    project: ({ cwd }) => path.join(cwd, ".claude", "skills"),
    global: ({ home }) => path.join(home, ".claude", "skills")
  },
  "claude-desktop": {
    // Claude Desktop reads the same per-user skills directory.
    global: ({ home }) => path.join(home, ".claude", "skills")
  },
  cursor: null,
  vscode: null,
  windsurf: null,
  codex: null,
  kiro: null,
  qoder: null
};

// Clients with a native rules/instructions system. "dir" = one rule doc per
// skill in a folder; "file" = a single instructions file (guidance section).
export const RULES_TARGETS = {
  "claude-code": {
    project: { kind: "file", resolve: ({ cwd }) => path.join(cwd, "CLAUDE.md") },
    global: { kind: "file", resolve: ({ home }) => path.join(home, ".claude", "CLAUDE.md") }
  },
  "claude-desktop": null, // no project rules file; skills/MCP only
  cursor: {
    // Cursor user-level "User Rules" live in app settings (no portable file).
    project: { kind: "dir", ext: ".md", resolve: ({ cwd }) => path.join(cwd, ".cursor", "rules") }
  },
  vscode: {
    project: { kind: "file", resolve: ({ cwd }) => path.join(cwd, ".github", "copilot-instructions.md") }
  },
  windsurf: {
    project: { kind: "dir", ext: ".md", resolve: ({ cwd }) => path.join(cwd, ".windsurf", "rules") },
    global: { kind: "file", resolve: ({ home }) => path.join(home, ".codeium", "windsurf", "memories", "global_rules.md") }
  },
  codex: {
    project: { kind: "file", resolve: ({ cwd }) => path.join(cwd, "AGENTS.md") },
    global: { kind: "file", resolve: ({ env, home }) => path.join(env.CODEX_HOME || path.join(home, ".codex"), "AGENTS.md") }
  },
  kiro: {
    project: { kind: "dir", ext: ".md", resolve: ({ cwd }) => path.join(cwd, ".kiro", "steering") }
  },
  qoder: {
    project: { kind: "dir", ext: ".md", resolve: ({ cwd }) => path.join(cwd, ".qoder", "rules") }
  }
};

export const GUIDANCE_MARKER_START = "<!-- free-figma-mcp:guidance:start -->";
export const GUIDANCE_MARKER_END = "<!-- free-figma-mcp:guidance:end -->";

// Capability summary for a client: which of skills/rules it supports and at
// which scopes. Used by the CLI to ask the right question.
export function clientCapabilities(clientKey) {
  const skills = SKILLS_TARGETS[clientKey] || null;
  const rules = RULES_TARGETS[clientKey] || null;
  const scopesOf = (t) => (t ? ["project", "global"].filter((s) => t[s]) : []);
  return {
    clientKey,
    skills: { supported: Boolean(skills), scopes: scopesOf(skills) },
    rules: { supported: Boolean(rules), scopes: scopesOf(rules) }
  };
}

export const PLUGIN_FILES = ["manifest.json", "code.js", "ui.html"];

// Resolve the OS "Downloads" directory. Windows/macOS use ~/Downloads; Linux
// honors $XDG_DOWNLOAD_DIR when set, else ~/Downloads.
export function downloadsDir({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  if (platform === "linux" && env.XDG_DOWNLOAD_DIR) {
    return env.XDG_DOWNLOAD_DIR;
  }
  return path.join(home, "Downloads");
}

// Build a single mcpServers/servers entry. Node mode points at the local
// server.js; npx mode runs the published package (with a cmd wrapper on win32).
export function buildServerEntry({
  serverEntry,
  useNpx = false,
  packageName = PACKAGE_NAME,
  platform = process.platform
} = {}) {
  if (useNpx) {
    if (platform === "win32") {
      return { command: "cmd", args: ["/c", "npx", "-y", packageName], env: {} };
    }
    return { command: "npx", args: ["-y", packageName], env: {} };
  }
  if (!serverEntry) {
    throw new Error("serverEntry is required when useNpx is false.");
  }
  return { command: "node", args: [serverEntry], env: {} };
}

// Merge a server entry into an existing client config without clobbering other
// servers or unrelated top-level keys. Returns a new object.
export function mergeConfig(existing, format, name, entry) {
  const config = existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...existing }
    : {};
  const key = format === "servers" ? "servers" : "mcpServers";
  const section = config[key] && typeof config[key] === "object" && !Array.isArray(config[key])
    ? { ...config[key] }
    : {};
  section[name] = format === "servers" ? { type: "stdio", ...entry } : entry;
  config[key] = section;
  return config;
}

// --- TOML (Codex) ------------------------------------------------------------

function tomlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function tomlKey(name) {
  return /^[A-Za-z0-9_-]+$/.test(name) ? name : tomlString(name);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Serialize a single [mcp_servers.<name>] block for Codex's config.toml.
export function serializeTomlServer(name, entry) {
  const lines = [`[mcp_servers.${tomlKey(name)}]`];
  lines.push(`command = ${tomlString(entry.command)}`);
  const args = Array.isArray(entry.args) ? entry.args : [];
  lines.push(`args = [${args.map(tomlString).join(", ")}]`);
  if (entry.env && Object.keys(entry.env).length > 0) {
    const pairs = Object.entries(entry.env)
      .map(([k, v]) => `${tomlKey(k)} = ${tomlString(String(v))}`)
      .join(", ");
    lines.push(`env = { ${pairs} }`);
  }
  return lines.join("\n");
}

// Insert or replace the [mcp_servers.<name>] block inside existing TOML text,
// leaving every other section untouched. No TOML parser dependency.
export function upsertTomlServer(existingText, name, entry) {
  const block = serializeTomlServer(name, entry);
  const text = String(existingText || "");
  const headerRe = new RegExp(`^\\[mcp_servers\\.${escapeRegExp(tomlKey(name))}\\][ \\t]*$`, "m");
  const match = headerRe.exec(text);

  if (!match) {
    const trimmed = text.replace(/\s*$/, "");
    const prefix = trimmed.length ? `${trimmed}\n\n` : "";
    return `${prefix}${block}\n`;
  }

  const start = match.index;
  const afterHeader = start + match[0].length;
  const rest = text.slice(afterHeader);
  const nextSection = rest.search(/\n\[/);
  const end = nextSection === -1 ? text.length : afterHeader + nextSection;

  const before = text.slice(0, start);
  const after = text.slice(end);
  const merged = `${before}${block}${after}`;
  return merged.endsWith("\n") ? merged : `${merged}\n`;
}

// --- Agent guidance -----------------------------------------------------------

// A compact, client-agnostic guidance snippet. It points the agent at the
// richer skills/steering the server already serves over MCP prompts/resources,
// and restates the non-negotiable use_figma rules.
export function guidanceSnippet() {
  return [
    GUIDANCE_MARKER_START,
    "## Free Figma MCP",
    "",
    "This project uses the `free-figma-mcp` MCP server to drive Figma Desktop through a local plugin bridge.",
    "",
    "- The server exposes official-style Figma tools (`get_metadata`, `get_design_context`, `use_figma`, `get_variable_defs`, ...) plus Config 2026 motion/slots/shader tools.",
    "- It also serves workflow **skills as MCP prompts** and **steering as MCP resources**. Consult them before generating Figma scripts.",
    "- `use_figma` runs JavaScript in the Figma plugin sandbox: colors are 0-1 range, load fonts before text ops (`await figma.loadFontAsync`), switch pages with `await figma.setCurrentPageAsync(page)`, return node IDs, and cooperate with `mcp.throwIfStopped()` for long scripts.",
    "- The active Figma Desktop document is the source of truth; `fileKey` arguments are accepted for compatibility only.",
    GUIDANCE_MARKER_END
  ].join("\n");
}

export function pluginInstructions(manifestPath) {
  return [
    "Import the Figma plugin into Figma Desktop:",
    "  1. Open Figma Desktop.",
    "  2. Go to: Plugins -> Development -> Import plugin from manifest...",
    "  3. Select this manifest file:",
    `       ${manifestPath}`,
    "  4. Run: Plugins -> Development -> Free Figma MCP Bridge",
    "  5. Press Start in the plugin window, then open or create a Figma draft."
  ].join("\n");
}

export function listClients() {
  return Object.entries(CLIENTS).map(([key, value]) => ({
    key,
    label: value.label,
    format: value.format,
    scope: value.scope
  }));
}

// Factory: binds the pure helpers to a concrete environment (fs, env, paths).
export function createInstaller({
  serverEntry,
  pluginDir,
  skillsDir,
  env = process.env,
  platform = process.platform,
  home = os.homedir(),
  cwd = process.cwd(),
  fileSystem = fs
} = {}) {
  function resolveClientPath(clientKey) {
    const client = CLIENTS[clientKey];
    if (!client) {
      throw new Error(`Unknown client "${clientKey}". Known: ${Object.keys(CLIENTS).join(", ")}`);
    }
    return client.resolvePath({ platform, env, home, cwd });
  }

  function configureClient(clientKey, { name = SERVER_NAME, useNpx = false, packageName = PACKAGE_NAME } = {}) {
    const client = CLIENTS[clientKey];
    if (!client) {
      throw new Error(`Unknown client "${clientKey}". Known: ${Object.keys(CLIENTS).join(", ")}`);
    }
    const configPath = resolveClientPath(clientKey);

    const entry = buildServerEntry({ serverEntry, useNpx, packageName, platform });

    if (client.format === "toml") {
      let existingText = "";
      if (fileSystem.existsSync(configPath)) {
        existingText = String(fileSystem.readFileSync(configPath, "utf8"));
      }
      const updated = upsertTomlServer(existingText, name, entry);
      fileSystem.mkdirSync(path.dirname(configPath), { recursive: true });
      fileSystem.writeFileSync(configPath, updated, "utf8");
      return { clientKey, label: client.label, configPath, format: client.format, name, entry };
    }

    let existing = {};
    if (fileSystem.existsSync(configPath)) {
      const raw = String(fileSystem.readFileSync(configPath, "utf8")).trim();
      if (raw) {
        try {
          existing = JSON.parse(raw);
        } catch (error) {
          throw new Error(`Existing config at ${configPath} is not valid JSON: ${error.message}`);
        }
      }
    }

    const merged = mergeConfig(existing, client.format, name, entry);

    fileSystem.mkdirSync(path.dirname(configPath), { recursive: true });
    fileSystem.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

    return { clientKey, label: client.label, configPath, format: client.format, name, entry };
  }

  function installPlugin(destDir) {
    if (!pluginDir) {
      throw new Error("pluginDir is required to install the Figma plugin files.");
    }
    const target = destDir || pluginDir;
    fileSystem.mkdirSync(target, { recursive: true });
    const copied = [];
    for (const file of PLUGIN_FILES) {
      const from = path.join(pluginDir, file);
      const to = path.join(target, file);
      if (from !== to) {
        fileSystem.copyFileSync(from, to);
      }
      copied.push(to);
    }
    const manifestPath = path.join(target, "manifest.json");
    return { destDir: target, copied, manifestPath };
  }

  // Suggested place to copy the plugin: <Downloads>/free-figma-mcp-plugin.
  function suggestedPluginDir() {
    return path.join(downloadsDir({ platform, env, home }), "free-figma-mcp-plugin");
  }

  function discoverSkillIds() {
    if (!skillsDir) return [];
    let entries;
    try {
      entries = fileSystem.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const ids = [];
    for (const entry of entries) {
      const isDir = typeof entry.isDirectory === "function" ? entry.isDirectory() : false;
      if (!isDir) continue;
      if (fileSystem.existsSync(path.join(skillsDir, entry.name, "SKILL.md"))) {
        ids.push(entry.name);
      }
    }
    return ids;
  }

  // Install Agent Skills (SKILL.md folders) into a client's skills store.
  // Only clients with a real skills directory are supported; others are told
  // to use installRules (rules) or rely on MCP-served skills.
  function installSkills(clientKey, { scope = "project" } = {}) {
    if (!(clientKey in SKILLS_TARGETS)) {
      throw new Error(`Unknown client "${clientKey}". Known: ${Object.keys(CLIENTS).join(", ")}`);
    }
    const target = SKILLS_TARGETS[clientKey];
    if (!target) {
      return {
        clientKey,
        skipped: true,
        reason: `${clientKey} has no Agent Skills store. Install them as rules instead, or rely on the MCP-served skills.`
      };
    }
    if (!skillsDir) {
      throw new Error("skillsDir is required to install skills.");
    }
    const resolver = target[scope];
    if (!resolver) {
      const have = ["project", "global"].filter((s) => target[s]).join(", ");
      return { clientKey, skipped: true, reason: `${clientKey} skills support ${have} scope, not "${scope}".` };
    }

    const skills = discoverSkillIds();
    const destDir = resolver({ home, cwd, env });
    fileSystem.mkdirSync(destDir, { recursive: true });
    for (const id of skills) {
      fileSystem.cpSync(path.join(skillsDir, id), path.join(destDir, id), { recursive: true });
    }
    return { clientKey, skipped: false, type: "skills", scope, destDir, skills };
  }

  // Install the guidance as a client's native RULES (different from skills):
  //   - "dir" clients get one rule doc per skill;
  //   - "file" clients get a single guidance section (markers, idempotent).
  function installRules(clientKey, { scope = "project" } = {}) {
    if (!(clientKey in RULES_TARGETS)) {
      throw new Error(`Unknown client "${clientKey}". Known: ${Object.keys(CLIENTS).join(", ")}`);
    }
    const target = RULES_TARGETS[clientKey];
    if (!target) {
      return {
        clientKey,
        skipped: true,
        reason: `${clientKey} has no rules store; skills are delivered over MCP prompts/resources.`
      };
    }
    const spec = target[scope];
    if (!spec) {
      const have = ["project", "global"].filter((s) => target[s]).join(", ");
      return { clientKey, skipped: true, reason: `${clientKey} rules support ${have} scope, not "${scope}".` };
    }

    if (spec.kind === "dir") {
      if (!skillsDir) throw new Error("skillsDir is required to install rules.");
      const ids = discoverSkillIds();
      const destDir = spec.resolve({ home, cwd, env });
      fileSystem.mkdirSync(destDir, { recursive: true });
      for (const id of ids) {
        const content = String(fileSystem.readFileSync(path.join(skillsDir, id, "SKILL.md"), "utf8"));
        fileSystem.writeFileSync(path.join(destDir, `${id}${spec.ext || ".md"}`), content, "utf8");
      }
      return { clientKey, skipped: false, type: "rules", kind: "dir", scope, destDir, rules: ids };
    }

    // kind "file": merge the marked guidance section into a single file.
    const filePath = spec.resolve({ home, cwd, env });
    const snippet = guidanceSnippet();
    let nextContent;
    let action;
    if (fileSystem.existsSync(filePath)) {
      const current = String(fileSystem.readFileSync(filePath, "utf8"));
      const blockRe = new RegExp(`${escapeRegExp(GUIDANCE_MARKER_START)}[\\s\\S]*?${escapeRegExp(GUIDANCE_MARKER_END)}`);
      if (blockRe.test(current)) {
        nextContent = current.replace(blockRe, snippet);
        action = "updated";
      } else {
        nextContent = `${current.replace(/\s*$/, "")}\n\n${snippet}\n`;
        action = "appended";
      }
    } else {
      nextContent = `${snippet}\n`;
      action = "created";
    }
    fileSystem.mkdirSync(path.dirname(filePath), { recursive: true });
    fileSystem.writeFileSync(filePath, nextContent, "utf8");
    return { clientKey, skipped: false, type: "rules", kind: "file", scope, filePath, action };
  }

  return { resolveClientPath, configureClient, installPlugin, suggestedPluginDir, installSkills, installRules };
}
