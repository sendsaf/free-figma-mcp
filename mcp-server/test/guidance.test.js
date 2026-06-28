import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFrontmatter, discoverSkills, discoverSteering, registerGuidance } from "../src/guidance.js";
import { skillsDir, steeringDir } from "../src/config.js";

test("parseFrontmatter: extracts name and description", () => {
  const fm = parseFrontmatter('---\nname: figma-motion\ndescription: "Read and author motion"\n---\n# Body');
  assert.equal(fm.name, "figma-motion");
  assert.equal(fm.description, "Read and author motion");
});

test("discoverSkills: finds the authored Config 2026 skills", () => {
  const skills = discoverSkills(skillsDir);
  const ids = skills.map((s) => s.id);
  assert.ok(ids.includes("figma-motion"), "expected figma-motion skill");
  assert.ok(ids.includes("figma-slots"), "expected figma-slots skill");
  const motion = skills.find((s) => s.id === "figma-motion");
  assert.ok(motion.content.includes("get_motion_context"), "skill content should be loaded");
});

test("discoverSteering: finds the config-2026 steering doc", () => {
  const docs = discoverSteering(steeringDir);
  assert.ok(docs.some((d) => d.id === "config-2026"), "expected config-2026 steering");
});

test("registerGuidance: registers prompts for skills and resources for steering", () => {
  const prompts = [];
  const resources = [];
  const stubServer = {
    registerPrompt: (name, config, cb) => { prompts.push({ name, config, cb }); },
    registerResource: (name, uri, config, cb) => { resources.push({ name, uri, config, cb }); }
  };
  const result = registerGuidance(stubServer, { skillsDir, steeringDir });

  assert.equal(prompts.length, result.skillCount);
  assert.equal(resources.length, result.steeringCount);
  assert.ok(prompts.some((p) => p.name === "skill-figma-motion"));
  assert.ok(resources.some((r) => r.name === "steering-config-2026"));

  // prompt callback returns a user message containing the skill text
  const motionPrompt = prompts.find((p) => p.name === "skill-figma-motion");
  const msg = motionPrompt.cb();
  assert.equal(msg.messages[0].role, "user");
  assert.match(msg.messages[0].content.text, /Figma Motion/);

  // resource callback returns markdown contents at the steering:// uri
  const steeringRes = resources.find((r) => r.name === "steering-config-2026");
  const read = steeringRes.cb("steering://config-2026");
  assert.equal(read.contents[0].mimeType, "text/markdown");
  assert.match(read.contents[0].text, /Config 2026/);
});
