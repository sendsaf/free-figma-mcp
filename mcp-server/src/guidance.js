// Guidance layer: serve skill workflows and steering docs over the MCP
// `prompts` and `resources` channels (the same surfaces Figma's official server
// uses), loaded from disk. Skills -> prompts; steering docs -> resources.

import fs from "node:fs";
import path from "node:path";

/** Parse a minimal YAML frontmatter block into a flat key/value object. */
export function parseFrontmatter(md) {
  const out = {};
  const m = String(md || "").match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) out[key] = val;
  }
  return out;
}

/** Discover skill docs (skills/<id>/SKILL.md). */
export function discoverSkills(skillsDir) {
  let entries = [];
  try { entries = fs.readdirSync(skillsDir, { withFileTypes: true }); } catch { return []; }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(skillsDir, entry.name, "SKILL.md");
    let content;
    try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
    const fm = parseFrontmatter(content);
    skills.push({ id: entry.name, name: fm.name || entry.name, description: fm.description || "", file, content });
  }
  return skills;
}

/** Discover steering docs (steeringDir/*.md). */
export function discoverSteering(steeringDir) {
  let entries = [];
  try { entries = fs.readdirSync(steeringDir, { withFileTypes: true }); } catch { return []; }
  const docs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const file = path.join(steeringDir, entry.name);
    let content;
    try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
    docs.push({ id: entry.name.replace(/\.md$/, ""), file, content });
  }
  return docs;
}

/**
 * Register discovered skills as MCP prompts and steering docs as MCP resources.
 * @returns {{skillCount:number, steeringCount:number}}
 */
export function registerGuidance(server, { skillsDir, steeringDir }) {
  const skills = discoverSkills(skillsDir);
  for (const skill of skills) {
    try {
      server.registerPrompt(
        `skill-${skill.id}`,
        { title: skill.name, description: skill.description.slice(0, 300) },
        () => ({ messages: [{ role: "user", content: { type: "text", text: skill.content } }] })
      );
    } catch { /* ignore duplicate/invalid registration */ }
  }

  const steering = discoverSteering(steeringDir);
  for (const doc of steering) {
    try {
      server.registerResource(
        `steering-${doc.id}`,
        `steering://${doc.id}`,
        { title: `Steering: ${doc.id}`, description: `Local Figma MCP steering: ${doc.id}`, mimeType: "text/markdown" },
        (uri) => ({ contents: [{ uri: typeof uri === "string" ? uri : uri.href, text: doc.content, mimeType: "text/markdown" }] })
      );
    } catch { /* ignore */ }
  }

  return { skillCount: skills.length, steeringCount: steering.length };
}
