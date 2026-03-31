#!/usr/bin/env node
// hooks/session-start.js
// On session start: ensure ~/.claude/commands/lwd/ has symlinks to plugin skills

import { existsSync, mkdirSync, readdirSync, symlinkSync, readlinkSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const COMMANDS_DIR = join(homedir(), ".claude", "commands", "lwd");
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
  || dirname(dirname(fileURLToPath(import.meta.url)));
const skillsDir = join(pluginRoot, ".claude", "skills");

try {
  if (!existsSync(skillsDir)) process.exit(0);

  mkdirSync(COMMANDS_DIR, { recursive: true });

  const skills = readdirSync(skillsDir).filter(
    (d) => existsSync(join(skillsDir, d, "SKILL.md"))
  );

  for (const skill of skills) {
    const src = join(skillsDir, skill, "SKILL.md");
    const dest = join(COMMANDS_DIR, `${skill}.md`);

    // Skip if already correctly linked
    if (existsSync(dest)) {
      try {
        if (readlinkSync(dest) === src) continue;
        unlinkSync(dest);
      } catch {
        unlinkSync(dest);
      }
    }

    symlinkSync(src, dest);
  }
} catch {
  // Silently fail — never block Claude Code startup
}
