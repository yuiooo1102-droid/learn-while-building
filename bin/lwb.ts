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

  default: {
    console.log(`Learn While Building v0.3.0

Usage:
  lwb serve    Start the teaching server
  lwb watch    Start the teaching display client
  lwb review   Browse past teaching content (offline)

The server receives events from Claude Code hooks and generates
teaching content. The watch client displays it in your terminal.
Review mode works offline without API key.`);
    break;
  }
}
