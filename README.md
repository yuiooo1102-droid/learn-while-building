# Learn While Building

**The AI builds your project. You learn programming. In real time.**

> A Claude Code plugin that turns every coding session into a live programming lesson. No textbooks, no tutorials — just real explanations of real code as it's being written.

```
/lwd:start
```

That's it. Open your browser, and watch concepts come alive as Claude codes.

---

## The Problem

You're using AI to build software. It writes amazing code. But you have no idea what any of it means.

You copy-paste. You ship. You learn nothing.

**Learn While Building fixes this.** Every time Claude writes code, you get a plain-English explanation of the programming concepts involved — delivered to a beautiful dashboard in your browser.

## How It Works

```
You: "Build me a REST API for my todo app"

Claude: *writes code*

Dashboard (in your browser):
┌─────────────────────────────────────────┐
│ HTTP Route Handlers                     │
│                                         │
│ A route is like an address for your     │
│ API — when someone visits /todos,       │
│ this code decides what to send back...  │
│                                         │
│ Concepts: REST API · HTTP Methods · ... │
└─────────────────────────────────────────┘
```

- **Real code, real explanations** — not abstract textbook examples
- **Adapts to your level** — tracks what you know, skips what you've mastered
- **Skill tree** — watch your knowledge grow across domains
- **Exercises** — test your understanding with contextual questions
- **Zero setup** — install the plugin and type `/lwd:start`

## Install

```bash
claude plugins marketplace add yuiooo1102-droid/learn-while-building
claude plugins install lwd@learn-while-building
```

Done. No `npm install`. No config files. No setup wizards.

## Commands

| Command | What it does |
|---------|-------------|
| `/lwd:start` | Start teaching mode + open dashboard |
| `/lwd:stop` | Pause teaching |
| `/lwd:set depth 3` | Set detail level (1-3) |
| `/lwd:set lang zh` | Switch language (zh/en/ja/auto) |
| `/lwd:set goal` | Set your learning goal |
| `/lwd:try` | Trigger a practice exercise |
| `/lwd:status` | View progress + skill tree |
| `/lwd:reset` | Start fresh |

## Dashboard

A warm, dark-themed browser dashboard at `http://localhost:3579`:

- **Live feed** — teaching cards appear in real time as Claude codes
- **Skill tree** — concepts organized by domain with progress bars
- **Search** — filter by keyword or concept (press `/` to focus)
- **Exercises** — answer directly in the dashboard
- **Today's summary** — track daily learning progress
- **Mobile friendly** — responsive layout with sidebar toggle

## What You'll Learn

As Claude builds your project, the dashboard explains:

- **Variables, functions, loops** — the building blocks
- **Async/await, promises** — how code handles waiting
- **APIs, HTTP, REST** — how apps talk to each other
- **Git, npm, builds** — the developer toolchain
- **Types, interfaces** — how TypeScript catches bugs
- **Design patterns** — why code is structured certain ways

Every concept is explained with everyday analogies, not jargon.

## Architecture

```
Claude Code                    Browser
    │                             │
    │ PostToolUse hook            │
    ├──────────► LWB Server ◄─────┤ WebSocket
    │            :3579            │
    │                             │
    │ additionalContext           │
    │◄──────────┤                 │
    │                             │
    │ curl POST /teach            │
    ├──────────►├─── broadcast ──►│
    │           │                 │
              ~/.learn-while-building/
              ├── knowledge.json
              ├── config.json
              ├── archive.jsonl
              └── concept-map.json
```

The plugin hooks into Claude Code's PostToolUse event. When Claude writes code, the server analyzes it and asks Claude to generate a teaching explanation. The explanation is broadcast to the dashboard via WebSocket. Your knowledge state is tracked locally — nothing leaves your machine.

## For Developers

```bash
git clone https://github.com/yuiooo1102-droid/learn-while-building.git
cd learn-while-building
npm install
npm run build
npm test         # 14 test files, 87 tests
```

### Project Structure

```
.claude-plugin/     Plugin metadata
.claude/skills/     6 slash commands (SKILL.md)
hooks/              PostToolUse + SessionStart hooks
src/server/         Fastify server + WebSocket
src/teaching/       Knowledge tracking, skill tree, exercises
src/web/            Browser dashboard (single HTML file)
dist/               Compiled JS (shipped with plugin)
tests/              Vitest test suite
```

## License

MIT
