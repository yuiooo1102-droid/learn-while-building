#!/usr/bin/env node
// bin/lwb.ts
import { argv } from "node:process";

const command = argv[2];

switch (command) {
  case "serve": {
    const { startServer } = await import("../src/server/index.js");
    await startServer();
    break;
  }

  case "watch": {
    await import("../src/watch/cli.js");
    break;
  }

  case "review": {
    await import("../src/watch/review-cli.js");
    break;
  }

  case "setup": {
    const { setup } = await import("../src/setup/index.js");
    await setup();
    break;
  }

  default: {
    console.log(`Learn While Building v0.3.0

Usage:
  lwb setup    First-time setup (install skill + optional StatusLine)
  lwb serve    Start the teaching server
  lwb watch    Start the teaching display client
  lwb review   Browse past teaching content (offline)

Get started: run 'lwb setup' first, then use /learn start in Claude Code.`);
    break;
  }
}
