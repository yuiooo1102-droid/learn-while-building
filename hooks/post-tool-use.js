#!/usr/bin/env node
// hooks/post-tool-use.js
// PostToolUse hook proxy — reads event from stdin, POSTs to LWB server

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const LWB_DIR = join(homedir(), ".learn-while-building");
const ACTIVE_MARKER = join(LWB_DIR, ".active");
const SERVER_PID_FILE = join(LWB_DIR, ".server-pid");
const PORT = 3579;
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;
const EVENT_URL = `http://127.0.0.1:${PORT}/event`;

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    await handleEvent(input);
  } catch {
    // Silently fail — never block Claude Code
  }
});

async function isServerAlive() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function startServer() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
    || dirname(dirname(fileURLToPath(import.meta.url)));
  const serverPath = join(pluginRoot, "dist", "src", "server", "index.js");

  if (!existsSync(serverPath)) return false;

  const child = spawn("node", [serverPath], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, LWB_PLUGIN_ROOT: pluginRoot },
  });
  child.unref();

  try {
    mkdirSync(LWB_DIR, { recursive: true });
    writeFileSync(SERVER_PID_FILE, String(child.pid));
  } catch {}

  return true;
}

async function waitForServer(maxMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isServerAlive()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function handleEvent(rawInput) {
  if (!existsSync(ACTIVE_MARKER)) return;

  let event;
  try {
    event = JSON.parse(rawInput);
  } catch {
    return;
  }

  let alive = await isServerAlive();
  if (!alive) {
    startServer();
    alive = await waitForServer();
  }
  if (!alive) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawInput,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();

    if (data.hookSpecificOutput) {
      process.stdout.write(JSON.stringify(data));
    }
  } catch {
    // Silently fail
  }
}
