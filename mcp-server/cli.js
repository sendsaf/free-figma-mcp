#!/usr/bin/env node
// =============================================================================
// Free Figma MCP — interactive setup CLI
//
// Wires the MCP server into an IDE/client config and helps install the Figma
// plugin. Interactive by default; supports headless flags for scripting:
//
//   node cli.js                      # interactive menu
//   node cli.js --client cursor      # configure one client, print plugin steps
//   node cli.js --plugin [dir]       # copy plugin files (default: repo plugin)
//   node cli.js --print              # print the mcpServers JSON only
//   node cli.js --npx                # use the published package via npx
//   node cli.js --name my-figma      # override the server key name
// =============================================================================

import readline from "node:readline";
import path from "node:path";
import {
  CLIENTS,
  PACKAGE_NAME,
  SERVER_NAME,
  buildServerEntry,
  clientCapabilities,
  createInstaller,
  listClients,
  mergeConfig,
  pluginInstructions
} from "./src/installer.js";
import { pluginDir, serverEntry, skillsDir } from "./src/config.js";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--npx") args.npx = true;
    else if (token === "--print") args.print = true;
    else if (token === "--skills") args.skills = true;
    else if (token === "--rules" || token === "--guidance") args.rules = true;
    else if (token === "--global") args.scope = "global";
    else if (token === "--scope") args.scope = argv[++i];
    else if (token === "--client") args.client = argv[++i];
    else if (token === "--name") args.name = argv[++i];
    else if (token === "--plugin") {
      // Optional value: only consume the next token if it isn't another flag.
      const next = argv[i + 1];
      args.plugin = next && !next.startsWith("--") ? argv[++i] : true;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    } else {
      args._.push(token);
    }
  }
  return args;
}

function printHelp() {
  const clients = listClients().map((c) => `    ${c.key.padEnd(16)} ${c.label}`).join("\n");
  process.stdout.write(`Free Figma MCP setup\n\n` +
    `Usage:\n` +
    `  node cli.js                  Interactive setup\n` +
    `  node cli.js --client <key>   Configure a client (then print plugin steps)\n` +
    `  node cli.js --plugin [dir]   Copy the Figma plugin files (default: repo plugin dir)\n` +
    `  node cli.js --skills         Install Agent Skills (SKILL.md folders) — skill-capable clients\n` +
    `  node cli.js --rules          Install the guidance as the client's native rules\n` +
    `  node cli.js --scope <s>      project (default) or global; --global is shorthand\n` +
    `  node cli.js --print          Print the mcpServers JSON only\n` +
    `  node cli.js --npx            Configure to run the published package via npx\n` +
    `  node cli.js --name <key>     Override the MCP server key (default: ${SERVER_NAME})\n\n` +
    `Skills vs rules: skills are model-invoked SKILL.md folders (Claude Code/Desktop);\n` +
    `rules are each client's native instruction system (Cursor/Kiro/Codex/Qoder/etc).\n\n` +
    `Clients:\n${clients}\n`);
}

function printConfigJson({ useNpx, name }) {
  const entry = buildServerEntry({ serverEntry, useNpx, packageName: PACKAGE_NAME });
  const json = mergeConfig({}, "mcpServers", name || SERVER_NAME, entry);
  process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
}

// Buffered line prompter. Using rl.question sequentially with piped (non-TTY)
// stdin drops lines emitted during await gaps; this queues every line so the
// flow is reliable for both interactive terminals and scripted input.
function createPrompter(rl) {
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on("line", (line) => {
    if (waiters.length) waiters.shift()(line.trim());
    else queue.push(line.trim());
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()("");
  });
  return function ask(question) {
    if (question) process.stdout.write(question);
    if (queue.length) return Promise.resolve(queue.shift());
    if (closed) return Promise.resolve("");
    return new Promise((resolve) => waiters.push(resolve));
  };
}

async function runInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = createPrompter(rl);
  const installer = createInstaller({ serverEntry, pluginDir, skillsDir });
  try {
    process.stdout.write("\nFree Figma MCP — setup\n======================\n\n");
    process.stdout.write("What do you want to do?\n");
    process.stdout.write("  1) Configure an IDE / MCP client\n");
    process.stdout.write("  2) Install the Figma plugin\n");
    process.stdout.write("  3) Do both\n");
    process.stdout.write("  4) Print the MCP config JSON\n");
    process.stdout.write("  5) Exit\n\n");
    const choice = await ask("Choice [1-5]: ");

    const useNpx = ["1", "3"].includes(choice)
      ? /^y/i.test(await ask("Run the published package via npx instead of this local clone? [y/N]: "))
      : false;

    if (choice === "1" || choice === "3") {
      await chooseAndConfigure(ask, installer, useNpx);
    }
    if (["1", "2", "3"].includes(choice)) {
      await offerPluginInstall(ask, installer);
    }
    if (choice === "4") {
      printConfigJson({ useNpx: false });
    }
    if (choice === "5" || !["1", "2", "3", "4"].includes(choice)) {
      process.stdout.write("\nNothing to do. Bye.\n");
    }
  } finally {
    rl.close();
  }
}

async function askScope(ask, scopes, what) {
  if (scopes.length === 0) return "project";
  if (scopes.length === 1) {
    process.stdout.write(`  (${what}: only ${scopes[0]} scope is supported here)\n`);
    return scopes[0];
  }
  const answer = await ask(`  Scope for ${what} — [project] this workspace, or [global] all projects? [project/global]: `);
  return /^g/i.test(answer) ? "global" : "project";
}

async function chooseAndConfigure(ask, installer, useNpx) {
  const clients = listClients();
  process.stdout.write("\nWhich client?\n");
  clients.forEach((c, i) => process.stdout.write(`  ${i + 1}) ${c.label}\n`));
  const raw = await ask(`Choice [1-${clients.length}]: `);
  const index = Number(raw) - 1;
  const client = clients[index];
  if (!client) {
    process.stdout.write("Invalid choice; skipping client configuration.\n");
    return;
  }
  const result = installer.configureClient(client.key, { useNpx });
  process.stdout.write(`\nConfigured ${result.label}\n  -> ${result.configPath}\n`);

  const caps = clientCapabilities(client.key);

  // Skills (Agent Skills = model-invoked SKILL.md folders).
  if (caps.skills.supported) {
    const want = await ask("\nInstall the Figma Agent Skills (SKILL.md folders) for this client? [Y/n]: ");
    if (!/^n/i.test(want)) {
      const scope = await askScope(ask, caps.skills.scopes, "skills");
      const s = installer.installSkills(client.key, { scope });
      process.stdout.write(s.skipped
        ? `Skills: ${s.reason}\n`
        : `Skills installed (${s.scope}): ${s.skills.length} skill folders -> ${s.destDir}\n`);
    }
  }

  // Rules (the client's native instruction system) — different from skills.
  if (caps.rules.supported) {
    const want = await ask("\nInstall the Figma guidance as this client's native rules? [Y/n]: ");
    if (!/^n/i.test(want)) {
      const scope = await askScope(ask, caps.rules.scopes, "rules");
      const r = installer.installRules(client.key, { scope });
      if (r.skipped) {
        process.stdout.write(`Rules: ${r.reason}\n`);
      } else if (r.kind === "dir") {
        process.stdout.write(`Rules installed (${r.scope}): ${r.rules.length} rule docs -> ${r.destDir}\n`);
      } else {
        process.stdout.write(`Rules ${r.action} (${r.scope}): ${r.filePath}\n`);
      }
    }
  }

  if (!caps.skills.supported && !caps.rules.supported) {
    process.stdout.write("\nThis client has no skills/rules store — it reads them over the MCP server's prompts/resources automatically.\n");
  }
}

async function offerPluginInstall(ask, installer) {
  const want = await ask("\nCopy the Figma plugin files so you can import them into Figma? [Y/n]: ");
  if (/^n/i.test(want)) {
    process.stdout.write(`\n${pluginInstructions(path.join(pluginDir, "manifest.json"))}\n`);
    return;
  }
  const suggested = installer.suggestedPluginDir();
  const answer = await ask(
    `Where should the plugin files go?\n  [Enter] = ${suggested}\n  or type a folder path, or '.' for the current directory: `
  );
  let dest = !answer ? suggested : (answer === "." ? process.cwd() : answer);
  try {
    const result = installer.installPlugin(dest);
    process.stdout.write(`\nPlugin files ready in: ${result.destDir}\n\n${pluginInstructions(result.manifestPath)}\n`);
  } catch (err) {
    process.stdout.write(`\nCould not write to ${dest}: ${err.message}\n`);
    const retry = await ask("Enter a different folder, or press Enter for the current directory: ");
    const dest2 = retry || process.cwd();
    const result = installer.installPlugin(dest2);
    process.stdout.write(`\nPlugin files ready in: ${result.destDir}\n\n${pluginInstructions(result.manifestPath)}\n`);
  }
}

async function runHeadless(args) {
  const installer = createInstaller({ serverEntry, pluginDir, skillsDir });

  if (args.print) {
    printConfigJson({ useNpx: Boolean(args.npx), name: args.name });
    return;
  }

  let didSomething = false;

  if (args.client) {
    if (!CLIENTS[args.client]) {
      process.stderr.write(`Unknown client "${args.client}". Known: ${Object.keys(CLIENTS).join(", ")}\n`);
      process.exitCode = 1;
      return;
    }
    const result = installer.configureClient(args.client, { useNpx: Boolean(args.npx), name: args.name });
    process.stdout.write(`Configured ${result.label}\n  -> ${result.configPath}\n`);
    didSomething = true;
  }

  if (args.skills) {
    if (!args.client) {
      process.stderr.write("--skills requires --client <key>.\n");
      process.exitCode = 1;
      return;
    }
    const s = installer.installSkills(args.client, { scope: args.scope || "project" });
    if (s.skipped) {
      process.stdout.write(`Skills: ${s.reason}\n`);
    } else {
      process.stdout.write(`Skills installed (${s.scope}): ${s.skills.length} skill folders -> ${s.destDir}\n`);
    }
    didSomething = true;
  }

  if (args.rules) {
    if (!args.client) {
      process.stderr.write("--rules requires --client <key>.\n");
      process.exitCode = 1;
      return;
    }
    const r = installer.installRules(args.client, { scope: args.scope || "project" });
    if (r.skipped) {
      process.stdout.write(`Rules: ${r.reason}\n`);
    } else if (r.kind === "dir") {
      process.stdout.write(`Rules installed (${r.scope}): ${r.rules.length} rule docs -> ${r.destDir}\n`);
    } else {
      process.stdout.write(`Rules ${r.action} (${r.scope}): ${r.filePath}\n`);
    }
    didSomething = true;
  }

  if (args.plugin) {
    const destDir = typeof args.plugin === "string" ? args.plugin : installer.suggestedPluginDir();
    const result = installer.installPlugin(destDir);
    process.stdout.write(`Plugin files ready in: ${result.destDir}\n`);
    process.stdout.write(`\n${pluginInstructions(result.manifestPath)}\n`);
    didSomething = true;
  } else if (args.client) {
    // Configured a client but didn't ask to copy the plugin — show import steps
    // from the source location so the user can import it manually.
    process.stdout.write(`\n${pluginInstructions(path.join(pluginDir, "manifest.json"))}\n`);
  }

  if (!didSomething) {
    printHelp();
  }
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
} else if (args.print || args.client || args.plugin || args.npx || args.name || args.rules || args.skills) {
  await runHeadless(args);
} else {
  await runInteractive();
}
