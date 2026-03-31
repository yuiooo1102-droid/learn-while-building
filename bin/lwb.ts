#!/usr/bin/env node
// bin/lwb.ts
import { argv } from "node:process";
import { execSync } from "node:child_process";
import { platform } from "node:os";

const command = argv[2];

function openBrowser(url: string) {
  try {
    const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
    execSync(`${cmd} ${url}`, { stdio: "ignore" });
  } catch {
    console.log(`Open in browser: ${url}`);
  }
}

switch (command) {
  case "serve": {
    const { startServer } = await import("../src/server/index.js");
    await startServer();
    break;
  }

  case "watch": {
    if (argv.includes("--terminal")) {
      await import("../src/watch/cli.js");
    } else {
      const url = "http://localhost:3579";
      console.log(`Opening dashboard: ${url}`);
      openBrowser(url);
    }
    break;
  }

  case "review": {
    if (argv.includes("--terminal")) {
      await import("../src/watch/review-cli.js");
    } else {
      const url = "http://localhost:3579";
      console.log(`Opening dashboard: ${url}`);
      openBrowser(url);
    }
    break;
  }

  case "setup": {
    const { setup } = await import("../src/setup/index.js");
    await setup();
    break;
  }

  default: {
    console.log(`Learn While Building v0.4.0

Usage:
  lwb setup            First-time setup (install skill + optional StatusLine)
  lwb serve            Start the teaching server
  lwb watch            Open dashboard in browser (--terminal for Ink client)
  lwb review           Open dashboard in browser (--terminal for Ink client)

Get started: run 'lwb setup' first, then use /learn start in Claude Code.
Dashboard: http://localhost:3579`);
    break;
  }
}
