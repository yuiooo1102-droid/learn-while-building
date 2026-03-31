#!/usr/bin/env node
// Learn While Building — StatusLine wrapper
// Runs the original GSD statusline, then appends learning status if active.

const { execSync } = require("child_process");
const http = require("http");

// Read stdin (session JSON from Claude Code)
let input = "";
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  clearTimeout(stdinTimeout);
  run();
});

function run() {
  // Step 1: Run original GSD statusline with the same stdin
  let gsdOutput = "";
  try {
    gsdOutput = execSync("node ~/.claude/hooks/gsd-statusline.js", {
      input,
      encoding: "utf8",
      timeout: 2000,
    }).trim();
  } catch {
    // GSD script not found or failed — continue without it
  }

  // Step 2: Check learning status (non-blocking, fast timeout)
  const req = http.get("http://127.0.0.1:3579/statusline", { timeout: 300 }, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      try {
        const status = JSON.parse(body);
        const learnBadge = status.active
          ? `📖 ${status.concepts}c/${status.mastered}m 🟢`
          : `📖 ${status.concepts}c/${status.mastered}m ⚪`;
        console.log(gsdOutput ? `${gsdOutput} | ${learnBadge}` : learnBadge);
      } catch {
        if (gsdOutput) console.log(gsdOutput);
      }
    });
  });

  req.on("error", () => {
    // lwb server not running — just show GSD output
    if (gsdOutput) console.log(gsdOutput);
  });

  req.on("timeout", () => {
    req.destroy();
    if (gsdOutput) console.log(gsdOutput);
  });
}
