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

  default: {
    console.log(`Learn While Building v0.1.0

Usage:
  lwb serve    Start the teaching server
  lwb watch    Start the teaching display client

The server receives events from Claude Code hooks and generates
teaching content. The watch client displays it in your terminal.`);
    break;
  }
}
