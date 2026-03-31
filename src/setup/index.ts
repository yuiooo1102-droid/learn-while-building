import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const HOOKS_DIR = join(homedir(), ".claude", "hooks");
const LWB_STATUSLINE_SRC = join(import.meta.dirname, "..", "statusline", "lwb-statusline.js");
const LWB_STATUSLINE_DEST = join(HOOKS_DIR, "lwb-statusline.js");
const COMMANDS_DIR = join(homedir(), ".claude", "commands");
const SKILL_SRC = join(import.meta.dirname, "..", "skill", "learn.md");
const SKILL_DEST = join(COMMANDS_DIR, "learn.md");

const LWB_HOOK_CONFIG = {
  hooks: [
    {
      type: "http",
      url: "http://127.0.0.1:3579/event",
      timeout: 5,
    },
  ],
};

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(CLAUDE_SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  await mkdir(join(homedir(), ".claude"), { recursive: true });
  await writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function hasLwbHook(settings: Record<string, unknown>): boolean {
  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (!hooks) return false;
  const postToolUse = hooks.PostToolUse as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(postToolUse)) return false;
  return postToolUse.some((entry) => {
    const innerHooks = entry.hooks as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(innerHooks)) return false;
    return innerHooks.some((h) => String(h.url ?? "").includes("3579/event"));
  });
}

export async function setup() {
  console.log("\n📖 Learn While Building — Setup\n");

  // Step 1: Install /learn skill command
  console.log("1. Installing /learn skill command...");
  await mkdir(COMMANDS_DIR, { recursive: true });
  await copyFile(SKILL_SRC, SKILL_DEST);
  console.log("   ✓ /learn command installed\n");

  // Step 2: Install PostToolUse hook (global, persistent)
  console.log("2. Installing PostToolUse hook...");
  const settings = await readSettings();

  if (hasLwbHook(settings)) {
    console.log("   ✓ Hook already installed, skipping\n");
  } else {
    const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
    const existingPostToolUse = (hooks.PostToolUse ?? []) as Array<Record<string, unknown>>;
    // Append lwb hook without removing existing hooks
    const updatedPostToolUse = [...existingPostToolUse, LWB_HOOK_CONFIG];
    settings.hooks = { ...hooks, PostToolUse: updatedPostToolUse };
    await writeSettings(settings);
    console.log("   ✓ Hook installed (appended to existing hooks)\n");
  }

  // Step 3: StatusLine integration (optional)
  console.log("3. StatusLine integration (optional)");
  const existingStatusLine = settings.statusLine as Record<string, unknown> | undefined;

  if (existingStatusLine) {
    const existingCommand = String(existingStatusLine.command ?? "");
    console.log(`   Existing StatusLine detected: ${existingCommand}`);

    if (existingCommand.includes("lwb-statusline")) {
      console.log("   ✓ Already configured, skipping\n");
    } else {
      const answer = await ask("   Add learning status to your existing StatusLine? (y/N): ");
      if (answer.toLowerCase() === "y") {
        const wrapperContent = await readFile(LWB_STATUSLINE_SRC, "utf-8");
        const updatedWrapper = wrapperContent.replace(
          'node ~/.claude/hooks/gsd-statusline.js',
          existingCommand,
        );
        await mkdir(HOOKS_DIR, { recursive: true });
        await writeFile(LWB_STATUSLINE_DEST, updatedWrapper, { mode: 0o755 });

        settings.statusLine = {
          ...existingStatusLine,
          command: `node ${LWB_STATUSLINE_DEST}`,
        };
        await writeSettings(settings);
        console.log("   ✓ StatusLine updated (original preserved as fallback)\n");
      } else {
        console.log("   Skipped StatusLine integration\n");
      }
    }
  } else {
    const answer = await ask("   Add learning status to Claude Code status bar? (y/N): ");
    if (answer.toLowerCase() === "y") {
      await mkdir(HOOKS_DIR, { recursive: true });
      await copyFile(LWB_STATUSLINE_SRC, LWB_STATUSLINE_DEST);

      const wrapperContent = await readFile(LWB_STATUSLINE_DEST, "utf-8");
      const updatedWrapper = wrapperContent.replace(
        /gsdOutput = execSync\(.*?\)\.trim\(\);/s,
        'gsdOutput = "";',
      );
      await writeFile(LWB_STATUSLINE_DEST, updatedWrapper, { mode: 0o755 });

      settings.statusLine = {
        type: "command",
        command: `node ${LWB_STATUSLINE_DEST}`,
      };
      await writeSettings(settings);
      console.log("   ✓ StatusLine configured\n");
    } else {
      console.log("   Skipped StatusLine\n");
    }
  }

  // Done
  console.log("✅ Setup complete!\n");
  console.log("Usage:");
  console.log("  In Claude Code, just type: /learn start");
  console.log("  The hook is always installed — it silently does nothing when the server is off.\n");
}
