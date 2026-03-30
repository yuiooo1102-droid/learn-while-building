# Learn While Building MVP (v0.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code Skill that provides real-time teaching content in a terminal split pane while the user codes with Claude Code, helping non-programmers understand what AI is doing and why.

**Architecture:** A local Fastify server receives PostToolUse hook events from Claude Code via HTTP hook, generates teaching content through Claude API (Haiku), and pushes it via WebSocket to a terminal-based Ink client (`lwb watch`). Terminal detection auto-splits when possible (tmux), otherwise prompts manual split.

**Tech Stack:** TypeScript (ESM), Fastify, ws (WebSocket), Ink 5 + React 18, Anthropic SDK, Node.js >= 18

---

## File Map

```
learn-while-building/
├── src/
│   ├── server/
│   │   ├── index.ts              # Fastify server startup + WebSocket upgrade
│   │   └── hook-handler.ts       # POST /event handler, debounce logic
│   │
│   ├── teaching/
│   │   ├── generator.ts          # LLM teaching content generation
│   │   ├── knowledge.ts          # Knowledge tracker (read/write JSON)
│   │   ├── templates.ts          # Static templates for simple operations
│   │   └── session.ts            # Session context (recent steps buffer)
│   │
│   ├── terminal/
│   │   ├── detect.ts             # Detect terminal type from env vars
│   │   ├── tmux.ts               # tmux auto-split
│   │   └── manual.ts             # Manual split instructions
│   │
│   ├── watch/
│   │   ├── cli.tsx               # CLI entry point (#!/usr/bin/env node)
│   │   ├── app.tsx               # Main Ink app component
│   │   └── teaching-view.tsx     # Teaching content display component
│   │
│   ├── skill/
│   │   └── learn.md              # Claude Code Skill definition
│   │
│   └── types.ts                  # Shared type definitions
│
├── tests/
│   ├── hook-handler.test.ts
│   ├── generator.test.ts
│   ├── knowledge.test.ts
│   ├── templates.test.ts
│   ├── session.test.ts
│   ├── detect.test.ts
│   └── debounce.test.ts
│
├── bin/
│   └── lwb.ts                    # Main CLI entry (lwb serve / lwb watch)
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Initialize project**

```bash
cd /Users/wh/coding/learn-while-building
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "learn-while-building",
  "version": "0.1.0",
  "description": "Real-time teaching companion for Claude Code — learn programming while AI builds your project",
  "type": "module",
  "bin": {
    "lwb": "./dist/bin/lwb.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=18"
  },
  "license": "MIT",
  "files": [
    "dist",
    "src/skill"
  ]
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install fastify @fastify/websocket ws ink react ink-text-input @anthropic-ai/sdk
npm install -D typescript @types/react @types/ws vitest @sindresorhus/tsconfig
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Create src/types.ts**

```ts
export type HookEvent = {
  readonly session_id: string;
  readonly hook_event_name: string;
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly tool_response: Record<string, unknown>;
  readonly tool_use_id: string;
  readonly cwd: string;
  readonly timestamp?: string;
};

export type ConceptLevel = 0 | 1 | 2 | 3;

export type ConceptState = {
  readonly level: ConceptLevel;
  readonly encounters: number;
  readonly lastSeen: string;
};

export type KnowledgeStore = {
  readonly concepts: Record<string, ConceptState>;
};

export type TeachingContent = {
  readonly type: "teaching";
  readonly title: string;
  readonly explanation: string;
  readonly concepts: ReadonlyArray<{
    readonly name: string;
    readonly label: string;
    readonly level: ConceptLevel;
  }>;
  readonly reasoning: string;
};

export type WatchMessage =
  | TeachingContent
  | { readonly type: "status"; readonly message: string }
  | { readonly type: "loading"; readonly title: string };

export type SessionStep = {
  readonly toolName: string;
  readonly summary: string;
  readonly timestamp: string;
};
```

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p src/{server,teaching,terminal,watch,skill} tests bin
```

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/types.ts
git commit -m "chore: scaffold project with dependencies and shared types"
```

---

## Task 2: Knowledge Tracker

**Files:**
- Create: `src/teaching/knowledge.ts`
- Create: `tests/knowledge.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/knowledge.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  loadKnowledge,
  saveKnowledge,
  updateConcept,
  getConceptLevel,
} from "../src/teaching/knowledge.js";

const TEST_DIR = join(import.meta.dirname, ".tmp-knowledge-test");
const TEST_PATH = join(TEST_DIR, "knowledge.json");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("loadKnowledge", () => {
  it("returns empty store when file does not exist", async () => {
    const store = await loadKnowledge(TEST_PATH);
    expect(store).toEqual({ concepts: {} });
  });

  it("reads existing knowledge file", async () => {
    const data = { concepts: { variable: { level: 2, encounters: 5, lastSeen: "2026-03-30" } } };
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, JSON.stringify(data));
    const store = await loadKnowledge(TEST_PATH);
    expect(store.concepts.variable.level).toBe(2);
  });
});

describe("saveKnowledge", () => {
  it("writes knowledge to file", async () => {
    const store = { concepts: { loop: { level: 1, encounters: 3, lastSeen: "2026-03-30" } } };
    await saveKnowledge(TEST_PATH, store);
    const raw = await readFile(TEST_PATH, "utf-8");
    expect(JSON.parse(raw)).toEqual(store);
  });
});

describe("updateConcept", () => {
  it("creates new concept at level 1 on first encounter", () => {
    const store = { concepts: {} };
    const updated = updateConcept(store, "variable");
    expect(updated.concepts.variable.level).toBe(1);
    expect(updated.concepts.variable.encounters).toBe(1);
  });

  it("increments encounters without changing level", () => {
    const store = {
      concepts: { variable: { level: 1, encounters: 2, lastSeen: "2026-03-29" } },
    };
    const updated = updateConcept(store, "variable");
    expect(updated.concepts.variable.encounters).toBe(3);
    expect(updated.concepts.variable.level).toBe(1);
  });

  it("does not mutate original store", () => {
    const store = { concepts: {} };
    const updated = updateConcept(store, "variable");
    expect(store.concepts).toEqual({});
    expect(updated.concepts.variable).toBeDefined();
  });
});

describe("getConceptLevel", () => {
  it("returns 0 for unknown concept", () => {
    const store = { concepts: {} };
    expect(getConceptLevel(store, "unknown")).toBe(0);
  });

  it("returns stored level for known concept", () => {
    const store = {
      concepts: { variable: { level: 3, encounters: 10, lastSeen: "2026-03-30" } },
    };
    expect(getConceptLevel(store, "variable")).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/knowledge.test.ts
```

Expected: FAIL — module `../src/teaching/knowledge.js` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/teaching/knowledge.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { KnowledgeStore, ConceptLevel } from "../types.js";

export async function loadKnowledge(filePath: string): Promise<KnowledgeStore> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as KnowledgeStore;
  } catch {
    return { concepts: {} };
  }
}

export async function saveKnowledge(
  filePath: string,
  store: KnowledgeStore,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2));
}

export function updateConcept(
  store: KnowledgeStore,
  conceptName: string,
  newLevel?: ConceptLevel,
): KnowledgeStore {
  const existing = store.concepts[conceptName];
  const today = new Date().toISOString().slice(0, 10);

  const updatedConcept = existing
    ? {
        level: newLevel ?? existing.level,
        encounters: existing.encounters + 1,
        lastSeen: today,
      }
    : {
        level: (newLevel ?? 1) as ConceptLevel,
        encounters: 1,
        lastSeen: today,
      };

  return {
    concepts: {
      ...store.concepts,
      [conceptName]: updatedConcept,
    },
  };
}

export function getConceptLevel(
  store: KnowledgeStore,
  conceptName: string,
): ConceptLevel {
  return store.concepts[conceptName]?.level ?? 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/knowledge.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teaching/knowledge.ts tests/knowledge.test.ts
git commit -m "feat: add knowledge tracker with immutable updates"
```

---

## Task 3: Session Context Buffer

**Files:**
- Create: `src/teaching/session.ts`
- Create: `tests/session.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/session.test.ts
import { describe, it, expect } from "vitest";
import { createSession, addStep, getRecentSteps } from "../src/teaching/session.js";

describe("createSession", () => {
  it("creates empty session", () => {
    const session = createSession();
    expect(getRecentSteps(session, 3)).toEqual([]);
  });
});

describe("addStep", () => {
  it("adds a step to session", () => {
    const s0 = createSession();
    const s1 = addStep(s0, { toolName: "Write", summary: "Created index.ts", timestamp: "12:00" });
    expect(getRecentSteps(s1, 3)).toHaveLength(1);
  });

  it("does not mutate original session", () => {
    const s0 = createSession();
    const s1 = addStep(s0, { toolName: "Write", summary: "Created index.ts", timestamp: "12:00" });
    expect(getRecentSteps(s0, 3)).toHaveLength(0);
    expect(getRecentSteps(s1, 3)).toHaveLength(1);
  });

  it("keeps only last N steps when buffer exceeds limit", () => {
    let session = createSession(3);
    session = addStep(session, { toolName: "Write", summary: "step 1", timestamp: "12:00" });
    session = addStep(session, { toolName: "Edit", summary: "step 2", timestamp: "12:01" });
    session = addStep(session, { toolName: "Bash", summary: "step 3", timestamp: "12:02" });
    session = addStep(session, { toolName: "Write", summary: "step 4", timestamp: "12:03" });

    const steps = getRecentSteps(session, 10);
    expect(steps).toHaveLength(3);
    expect(steps[0].summary).toBe("step 2");
    expect(steps[2].summary).toBe("step 4");
  });
});

describe("getRecentSteps", () => {
  it("returns at most N steps", () => {
    let session = createSession();
    session = addStep(session, { toolName: "Write", summary: "step 1", timestamp: "12:00" });
    session = addStep(session, { toolName: "Edit", summary: "step 2", timestamp: "12:01" });
    session = addStep(session, { toolName: "Bash", summary: "step 3", timestamp: "12:02" });

    expect(getRecentSteps(session, 2)).toHaveLength(2);
    expect(getRecentSteps(session, 2)[0].summary).toBe("step 2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/session.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/teaching/session.ts
import type { SessionStep } from "../types.js";

export type Session = {
  readonly steps: ReadonlyArray<SessionStep>;
  readonly maxSteps: number;
};

export function createSession(maxSteps: number = 10): Session {
  return { steps: [], maxSteps };
}

export function addStep(session: Session, step: SessionStep): Session {
  const newSteps = [...session.steps, step];
  const trimmed =
    newSteps.length > session.maxSteps
      ? newSteps.slice(newSteps.length - session.maxSteps)
      : newSteps;

  return { steps: trimmed, maxSteps: session.maxSteps };
}

export function getRecentSteps(
  session: Session,
  count: number,
): ReadonlyArray<SessionStep> {
  return session.steps.slice(-count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/session.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teaching/session.ts tests/session.test.ts
git commit -m "feat: add immutable session context buffer"
```

---

## Task 4: Static Templates for Simple Operations

**Files:**
- Create: `src/teaching/templates.ts`
- Create: `tests/templates.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/templates.test.ts
import { describe, it, expect } from "vitest";
import { getTemplate, hasTemplate } from "../src/teaching/templates.js";

describe("hasTemplate", () => {
  it("returns true for Bash tool with simple commands", () => {
    expect(hasTemplate("Bash", { command: "ls" })).toBe(true);
    expect(hasTemplate("Bash", { command: "cd src" })).toBe(true);
    expect(hasTemplate("Bash", { command: "pwd" })).toBe(true);
    expect(hasTemplate("Bash", { command: "mkdir -p src/components" })).toBe(true);
  });

  it("returns false for Bash tool with complex commands", () => {
    expect(hasTemplate("Bash", { command: "npm install fastify" })).toBe(false);
    expect(hasTemplate("Bash", { command: "node src/index.ts" })).toBe(false);
  });

  it("returns false for tools without templates", () => {
    expect(hasTemplate("Write", { file_path: "/src/index.ts", content: "..." })).toBe(false);
    expect(hasTemplate("Edit", { file_path: "/src/index.ts" })).toBe(false);
  });

  it("returns true for Glob and Grep tools", () => {
    expect(hasTemplate("Glob", { pattern: "**/*.ts" })).toBe(true);
    expect(hasTemplate("Grep", { pattern: "import" })).toBe(true);
  });

  it("returns true for Read tool", () => {
    expect(hasTemplate("Read", { file_path: "/src/index.ts" })).toBe(true);
  });
});

describe("getTemplate", () => {
  it("returns teaching content for ls command", () => {
    const content = getTemplate("Bash", { command: "ls src" });
    expect(content).toBeDefined();
    expect(content!.title).toContain("ls");
    expect(content!.explanation).toBeTruthy();
  });

  it("returns null when no template matches", () => {
    expect(getTemplate("Write", { file_path: "x" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/templates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/teaching/templates.ts
import type { TeachingContent } from "../types.js";

type TemplateRule = {
  readonly tool: string;
  readonly match: (input: Record<string, unknown>) => boolean;
  readonly generate: (input: Record<string, unknown>) => TeachingContent;
};

const SIMPLE_BASH_COMMANDS = ["ls", "cd", "pwd", "mkdir", "cat", "echo", "clear", "which", "whoami"];

function isBashSimple(input: Record<string, unknown>): boolean {
  const cmd = String(input.command ?? "").trim();
  const firstWord = cmd.split(/\s/)[0];
  return SIMPLE_BASH_COMMANDS.includes(firstWord);
}

function bashTemplate(input: Record<string, unknown>): TeachingContent {
  const cmd = String(input.command ?? "").trim();
  const firstWord = cmd.split(/\s/)[0];

  const descriptions: Record<string, string> = {
    ls: "查看文件夹里有哪些文件和子文件夹，就像打开抽屉看看里面有什么。",
    cd: "切换到另一个文件夹，就像走进另一个房间。",
    pwd: "显示当前所在的文件夹路径，就像查看你在地图上的位置。",
    mkdir: "创建一个新的文件夹，就像在柜子里加一个新抽屉。",
    cat: "显示一个文件的全部内容。",
    echo: "在终端打印一段文字。",
    clear: "清空终端屏幕，让界面更整洁。",
    which: "查找一个命令安装在哪个位置。",
    whoami: "显示当前登录的用户名。",
  };

  return {
    type: "teaching",
    title: `执行命令: ${cmd}`,
    explanation: descriptions[firstWord] ?? `执行了 ${firstWord} 命令。`,
    concepts: [{ name: "terminal_command", label: "终端命令", level: 1 }],
    reasoning: "AI 在用终端命令来了解或整理项目的文件结构。",
  };
}

const rules: ReadonlyArray<TemplateRule> = [
  {
    tool: "Bash",
    match: isBashSimple,
    generate: bashTemplate,
  },
  {
    tool: "Read",
    match: () => true,
    generate: (input) => ({
      type: "teaching",
      title: `读取文件: ${String(input.file_path ?? "").split("/").pop()}`,
      explanation: "AI 正在阅读一个文件的内容，了解里面写了什么，就像翻开一页纸看看上面的内容。",
      concepts: [{ name: "file_read", label: "读取文件", level: 1 }],
      reasoning: "AI 需要先了解现有代码，才能做出合适的修改。",
    }),
  },
  {
    tool: "Glob",
    match: () => true,
    generate: (input) => ({
      type: "teaching",
      title: `搜索文件: ${String(input.pattern ?? "")}`,
      explanation: "AI 正在按名称模式搜索文件，就像在文件柜里按标签找文件。",
      concepts: [{ name: "file_search", label: "文件搜索", level: 1 }],
      reasoning: "AI 需要找到相关的文件才能继续工作。",
    }),
  },
  {
    tool: "Grep",
    match: () => true,
    generate: (input) => ({
      type: "teaching",
      title: `搜索内容: "${String(input.pattern ?? "")}"`,
      explanation: "AI 正在搜索文件内容中包含特定文字的地方，就像在一本书里搜索关键词。",
      concepts: [{ name: "content_search", label: "内容搜索", level: 1 }],
      reasoning: "AI 在查找代码中某个关键词出现的位置，以便理解代码结构。",
    }),
  },
];

export function hasTemplate(
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  return rules.some((r) => r.tool === toolName && r.match(toolInput));
}

export function getTemplate(
  toolName: string,
  toolInput: Record<string, unknown>,
): TeachingContent | null {
  const rule = rules.find((r) => r.tool === toolName && r.match(toolInput));
  return rule ? rule.generate(toolInput) : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/templates.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teaching/templates.ts tests/templates.test.ts
git commit -m "feat: add static teaching templates for simple operations"
```

---

## Task 5: Teaching Content Generator (LLM)

**Files:**
- Create: `src/teaching/generator.ts`
- Create: `tests/generator.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/generator.test.ts
import { describe, it, expect, vi } from "vitest";
import { generateTeaching, buildPrompt } from "../src/teaching/generator.js";
import type { HookEvent, KnowledgeStore, SessionStep } from "../src/types.js";

describe("buildPrompt", () => {
  it("includes tool name and input in prompt", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "/src/index.ts", content: "console.log('hello')" },
      tool_response: { success: true },
      tool_use_id: "t1",
      cwd: "/project",
    };

    const knowledge: KnowledgeStore = {
      concepts: {
        variable: { level: 3, encounters: 10, lastSeen: "2026-03-30" },
      },
    };

    const recentSteps: ReadonlyArray<SessionStep> = [
      { toolName: "Bash", summary: "npm init", timestamp: "12:00" },
    ];

    const prompt = buildPrompt(event, knowledge, recentSteps);

    expect(prompt).toContain("Write");
    expect(prompt).toContain("index.ts");
    expect(prompt).toContain("variable");
    expect(prompt).toContain("已掌握");
    expect(prompt).toContain("npm init");
  });

  it("handles empty knowledge store", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm install react" },
      tool_response: {},
      tool_use_id: "t2",
      cwd: "/project",
    };

    const prompt = buildPrompt(event, { concepts: {} }, []);
    expect(prompt).toContain("Bash");
    expect(prompt).toContain("npm install react");
  });
});

describe("generateTeaching", () => {
  it("calls Anthropic API and returns parsed content", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "安装 React",
            explanation: "这是一个UI框架",
            concepts: [{ name: "npm_install", label: "包安装", level: 1 }],
            reasoning: "项目需要 React 来构建界面",
          }),
        },
      ],
    });

    const mockClient = {
      messages: { create: mockCreate },
    };

    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm install react" },
      tool_response: {},
      tool_use_id: "t1",
      cwd: "/project",
    };

    const result = await generateTeaching(
      mockClient as any,
      event,
      { concepts: {} },
      [],
    );

    expect(result.type).toBe("teaching");
    expect(result.title).toBe("安装 React");
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toContain("haiku");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/generator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/teaching/generator.ts
import type Anthropic from "@anthropic-ai/sdk";
import type {
  HookEvent,
  KnowledgeStore,
  SessionStep,
  TeachingContent,
} from "../types.js";

const LEVEL_LABELS: Record<number, string> = {
  0: "未接触",
  1: "见过",
  2: "理解",
  3: "已掌握",
};

export function buildPrompt(
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
): string {
  const conceptEntries = Object.entries(knowledge.concepts);
  const knowledgeSection =
    conceptEntries.length > 0
      ? conceptEntries
          .map(([name, state]) => `- ${name}: ${LEVEL_LABELS[state.level]}`)
          .join("\n")
      : "- (暂无学习记录)";

  const stepsSection =
    recentSteps.length > 0
      ? recentSteps.map((s) => `- [${s.toolName}] ${s.summary}`).join("\n")
      : "- (这是第一步)";

  const inputStr = JSON.stringify(event.tool_input, null, 2);
  const responseStr = JSON.stringify(event.tool_response, null, 2).slice(0, 500);

  return `你是一个编程教师，正在向一个非程序员解释 AI 编程助手的操作。

当前用户知识状态：
${knowledgeSection}

刚才 AI 执行了以下操作：
- 工具: ${event.tool_name}
- 参数: ${inputStr}
- 结果: ${responseStr}

最近几步上下文：
${stepsSection}

请生成教学内容，严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "title": "简短标题（描述这步做了什么）",
  "explanation": "用生活化的语言解释这步操作，未接触的概念要详细解释并用类比，已掌握的概念一笔带过",
  "concepts": [{"name": "概念英文名", "label": "概念中文名", "level": 1}],
  "reasoning": "为什么 AI 选择这样做"
}

规则：
1. 已掌握的概念一笔带过
2. 见过的概念简短提醒
3. 未接触的概念详细解释，用生活化类比
4. 解释"为什么这样做"，不只是"做了什么"
5. explanation 控制在 150 字以内
6. 用中文`;
}

export async function generateTeaching(
  client: Anthropic,
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
): Promise<TeachingContent> {
  const prompt = buildPrompt(event, knowledge, recentSteps);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    return {
      type: "teaching",
      title: String(parsed.title ?? ""),
      explanation: String(parsed.explanation ?? ""),
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
      reasoning: String(parsed.reasoning ?? ""),
    };
  } catch {
    return {
      type: "teaching",
      title: `${event.tool_name} 操作`,
      explanation: text.slice(0, 300),
      concepts: [],
      reasoning: "",
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/generator.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teaching/generator.ts tests/generator.test.ts
git commit -m "feat: add LLM teaching content generator with Haiku"
```

---

## Task 6: Hook Handler with Debounce

**Files:**
- Create: `src/server/hook-handler.ts`
- Create: `tests/hook-handler.test.ts`
- Create: `tests/debounce.test.ts`

- [ ] **Step 1: Write the failing tests for debounce**

```ts
// tests/debounce.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncer } from "../src/server/hook-handler.js";

describe("createDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls handler after delay", async () => {
    const handler = vi.fn();
    const debounced = createDebouncer(300);
    debounced.push("event1", handler);

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledWith("event1");
  });

  it("replaces previous event within debounce window", () => {
    const handler = vi.fn();
    const debounced = createDebouncer(300);
    debounced.push("event1", handler);

    vi.advanceTimersByTime(100);
    debounced.push("event2", handler);

    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("event2");
  });
});
```

- [ ] **Step 2: Write the failing tests for hook handler**

```ts
// tests/hook-handler.test.ts
import { describe, it, expect } from "vitest";
import { parseHookEvent } from "../src/server/hook-handler.js";

describe("parseHookEvent", () => {
  it("parses valid PostToolUse event", () => {
    const body = {
      session_id: "s1",
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "/src/index.ts", content: "hello" },
      tool_response: { success: true },
      tool_use_id: "t1",
      cwd: "/project",
    };

    const event = parseHookEvent(body);
    expect(event).not.toBeNull();
    expect(event!.tool_name).toBe("Write");
  });

  it("returns null for invalid body", () => {
    expect(parseHookEvent({})).toBeNull();
    expect(parseHookEvent({ tool_name: "Write" })).toBeNull();
    expect(parseHookEvent(null)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/debounce.test.ts tests/hook-handler.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```ts
// src/server/hook-handler.ts
import type { HookEvent } from "../types.js";

export function parseHookEvent(body: unknown): HookEvent | null {
  if (body === null || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  if (
    typeof obj.tool_name !== "string" ||
    typeof obj.tool_use_id !== "string" ||
    typeof obj.cwd !== "string" ||
    typeof obj.session_id !== "string"
  ) {
    return null;
  }

  return {
    session_id: obj.session_id,
    hook_event_name: String(obj.hook_event_name ?? "PostToolUse"),
    tool_name: obj.tool_name,
    tool_input: (obj.tool_input as Record<string, unknown>) ?? {},
    tool_response: (obj.tool_response as Record<string, unknown>) ?? {},
    tool_use_id: obj.tool_use_id,
    cwd: obj.cwd,
    timestamp: new Date().toISOString(),
  };
}

export type Debouncer<T> = {
  push: (event: T, handler: (event: T) => void) => void;
};

export function createDebouncer<T>(delayMs: number): Debouncer<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestEvent: T | null = null;
  let latestHandler: ((event: T) => void) | null = null;

  return {
    push(event: T, handler: (event: T) => void) {
      latestEvent = event;
      latestHandler = handler;

      if (timer !== null) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        if (latestEvent !== null && latestHandler !== null) {
          latestHandler(latestEvent);
        }
        timer = null;
        latestEvent = null;
        latestHandler = null;
      }, delayMs);
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/debounce.test.ts tests/hook-handler.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/hook-handler.ts tests/debounce.test.ts tests/hook-handler.test.ts
git commit -m "feat: add hook event parser and debouncer"
```

---

## Task 7: Fastify Server with WebSocket

**Files:**
- Create: `src/server/index.ts`

- [ ] **Step 1: Write the server**

```ts
// src/server/index.ts
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import type { HookEvent, WatchMessage } from "../types.js";
import { parseHookEvent, createDebouncer } from "./hook-handler.js";
import { hasTemplate, getTemplate } from "../teaching/templates.js";
import { generateTeaching } from "../teaching/generator.js";
import {
  loadKnowledge,
  saveKnowledge,
  updateConcept,
} from "../teaching/knowledge.js";
import { createSession, addStep, getRecentSteps } from "../teaching/session.js";
import { homedir } from "node:os";
import { join } from "node:path";

const KNOWLEDGE_PATH = join(homedir(), ".learn-while-building", "knowledge.json");
const PORT = 3579;

export async function createServer() {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);

  const clients = new Set<WebSocket>();
  let session = createSession();
  let knowledge = await loadKnowledge(KNOWLEDGE_PATH);
  const anthropic = new Anthropic();
  const debouncer = createDebouncer<HookEvent>(300);

  function broadcast(message: WatchMessage) {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  async function processEvent(event: HookEvent) {
    const toolInput = event.tool_input as Record<string, unknown>;

    // Try static template first
    if (hasTemplate(event.tool_name, toolInput)) {
      const content = getTemplate(event.tool_name, toolInput);
      if (content) {
        broadcast(content);
        for (const concept of content.concepts) {
          knowledge = updateConcept(knowledge, concept.name);
        }
        await saveKnowledge(KNOWLEDGE_PATH, knowledge);
        session = addStep(session, {
          toolName: event.tool_name,
          summary: content.title,
          timestamp: event.timestamp ?? new Date().toISOString(),
        });
        return;
      }
    }

    // Use LLM for complex operations
    broadcast({ type: "loading", title: `AI 正在: ${event.tool_name}...` });

    try {
      const recentSteps = getRecentSteps(session, 3);
      const content = await generateTeaching(
        anthropic,
        event,
        knowledge,
        recentSteps,
      );

      broadcast(content);

      for (const concept of content.concepts) {
        knowledge = updateConcept(knowledge, concept.name, concept.level);
      }
      await saveKnowledge(KNOWLEDGE_PATH, knowledge);

      session = addStep(session, {
        toolName: event.tool_name,
        summary: content.title,
        timestamp: event.timestamp ?? new Date().toISOString(),
      });
    } catch (err) {
      broadcast({
        type: "status",
        message: `教学内容生成失败: ${String(err)}`,
      });
    }
  }

  // HTTP hook endpoint
  app.post("/event", async (request, reply) => {
    const event = parseHookEvent(request.body);
    if (!event) {
      return reply.status(400).send({ error: "Invalid event" });
    }

    debouncer.push(event, (e) => {
      processEvent(e).catch(console.error);
    });

    return reply.status(200).send();
  });

  // WebSocket endpoint for lwb watch clients
  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(
      JSON.stringify({ type: "status", message: "已连接到教学服务" }),
    );

    socket.on("close", () => {
      clients.delete(socket);
    });
  });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  return { app, port: PORT };
}

export async function startServer() {
  const { app, port } = await createServer();
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`Learn While Building server running on http://127.0.0.1:${port}`);
  return app;
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/index.ts
git commit -m "feat: add Fastify server with WebSocket and hook processing"
```

---

## Task 8: Terminal Detection and Splitting

**Files:**
- Create: `src/terminal/detect.ts`
- Create: `src/terminal/tmux.ts`
- Create: `src/terminal/manual.ts`
- Create: `tests/detect.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/detect.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { detectTerminal } from "../src/terminal/detect.js";

describe("detectTerminal", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("detects tmux", () => {
    process.env.TMUX = "/tmp/tmux-501/default,12345,0";
    expect(detectTerminal()).toBe("tmux");
  });

  it("detects Ghostty on macOS", () => {
    delete process.env.TMUX;
    process.env.GHOSTTY_RESOURCES_DIR = "/Applications/Ghostty.app/Contents/Resources";
    expect(detectTerminal()).toBe("ghostty");
  });

  it("detects Warp", () => {
    delete process.env.TMUX;
    delete process.env.GHOSTTY_RESOURCES_DIR;
    process.env.TERM_PROGRAM = "WarpTerminal";
    expect(detectTerminal()).toBe("warp");
  });

  it("returns unknown for unrecognized terminal", () => {
    delete process.env.TMUX;
    delete process.env.GHOSTTY_RESOURCES_DIR;
    process.env.TERM_PROGRAM = "SomeOther";
    expect(detectTerminal()).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/detect.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write detect.ts**

```ts
// src/terminal/detect.ts
export type TerminalType = "tmux" | "ghostty" | "warp" | "unknown";

export function detectTerminal(): TerminalType {
  if (process.env.TMUX) return "tmux";
  if (process.env.GHOSTTY_RESOURCES_DIR) return "ghostty";
  if (process.env.TERM_PROGRAM === "WarpTerminal") return "warp";
  return "unknown";
}
```

- [ ] **Step 4: Write tmux.ts**

```ts
// src/terminal/tmux.ts
import { execSync } from "node:child_process";

export function tmuxSplit(command: string): boolean {
  try {
    execSync(`tmux split-window -h "${command}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Write manual.ts**

```ts
// src/terminal/manual.ts
import type { TerminalType } from "./detect.js";

const INSTRUCTIONS: Record<string, string> = {
  warp: "请按 Cmd+D 分屏，然后在新 pane 中运行: lwb watch",
  ghostty: "请按 Cmd+D 分屏，然后在新 pane 中运行: lwb watch",
  unknown: "请手动打开一个新的终端窗口，然后运行: lwb watch",
};

export function getManualSplitInstructions(terminal: TerminalType): string {
  return INSTRUCTIONS[terminal] ?? INSTRUCTIONS.unknown;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/detect.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/detect.ts src/terminal/tmux.ts src/terminal/manual.ts tests/detect.test.ts
git commit -m "feat: add terminal detection and split strategies"
```

---

## Task 9: lwb watch — Ink Terminal Client

**Files:**
- Create: `src/watch/teaching-view.tsx`
- Create: `src/watch/app.tsx`
- Create: `src/watch/cli.tsx`

- [ ] **Step 1: Create teaching-view.tsx**

```tsx
// src/watch/teaching-view.tsx
import React from "react";
import { Box, Text } from "ink";
import type { TeachingContent, ConceptLevel } from "../types.js";

const LEVEL_ICONS: Record<ConceptLevel, string> = {
  0: "🔴",
  1: "🟡",
  2: "🔵",
  3: "🟢",
};

const LEVEL_LABELS: Record<ConceptLevel, string> = {
  0: "未接触",
  1: "见过",
  2: "理解",
  3: "已掌握",
};

type Props = {
  readonly content: TeachingContent;
};

export default function TeachingView({ content }: Props) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="cyan">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
      <Box>
        <Text bold>📖 {content.title}</Text>
      </Box>
      <Box>
        <Text bold color="cyan">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>这一步做了什么：</Text>
        <Text>  {content.explanation}</Text>
      </Box>

      {content.concepts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>涉及概念：</Text>
          {content.concepts.map((c) => (
            <Text key={c.name}>
              {"  "}• {c.label} ({c.name}) {LEVEL_ICONS[c.level]}{" "}
              {LEVEL_LABELS[c.level]}
            </Text>
          ))}
        </Box>
      )}

      {content.reasoning && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>为什么这样做：</Text>
          <Text>  {content.reasoning}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text bold color="cyan">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Create app.tsx**

```tsx
// src/watch/app.tsx
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { WatchMessage, TeachingContent } from "../types.js";
import TeachingView from "./teaching-view.js";

type Props = {
  readonly port: number;
};

export default function App({ port }: Props) {
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState<TeachingContent | null>(null);
  const [status, setStatus] = useState<string>("正在连接...");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    ws.onopen = () => {
      setConnected(true);
      setStatus("已连接，等待 Claude Code 操作...");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WatchMessage;

        if (msg.type === "teaching") {
          setContent(msg);
          setLoading(null);
        } else if (msg.type === "loading") {
          setLoading(msg.title);
        } else if (msg.type === "status") {
          setStatus(msg.message);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      setConnected(false);
      setStatus("连接失败，请确认教学服务已启动 (lwb serve)");
    };

    ws.onclose = () => {
      setConnected(false);
      setStatus("连接已断开");
    };

    return () => ws.close();
  }, [port]);

  return (
    <Box flexDirection="column">
      <Box paddingX={1} marginBottom={1}>
        <Text color={connected ? "green" : "red"}>
          {connected ? "●" : "○"}{" "}
        </Text>
        <Text bold> Learn While Building</Text>
      </Box>

      {loading && (
        <Box paddingX={1}>
          <Text color="yellow">⏳ {loading}</Text>
        </Box>
      )}

      {content && !loading && <TeachingView content={content} />}

      {!content && !loading && (
        <Box paddingX={1}>
          <Text color="gray">{status}</Text>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 3: Create cli.tsx**

```tsx
#!/usr/bin/env node
// src/watch/cli.tsx
import React from "react";
import { render } from "ink";
import App from "./app.js";

const port = parseInt(process.env.LWB_PORT ?? "3579", 10);
render(<App port={port} />);
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/watch/teaching-view.tsx src/watch/app.tsx src/watch/cli.tsx
git commit -m "feat: add lwb watch Ink terminal client"
```

---

## Task 10: CLI Entry Point

**Files:**
- Create: `bin/lwb.ts`

- [ ] **Step 1: Create CLI entry point**

```ts
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
```

- [ ] **Step 2: Update tsconfig.json rootDir to include bin**

Update `tsconfig.json` — change `rootDir` from `"src"` to `"."` and add `bin` to `include`:

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src", "bin"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Update package.json bin path**

Update the `bin` field in `package.json`:

```json
{
  "bin": {
    "lwb": "./dist/bin/lwb.js"
  }
}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add bin/lwb.ts tsconfig.json package.json
git commit -m "feat: add lwb CLI entry point (serve/watch commands)"
```

---

## Task 11: Claude Code Skill Definition

**Files:**
- Create: `src/skill/learn.md`

- [ ] **Step 1: Create the skill definition**

```markdown
---
name: learn
description: Start/stop real-time teaching mode. Use when user wants to learn programming concepts while Claude Code builds their project.
---

# Learn While Building — Teaching Mode

You are activating the real-time teaching mode for a non-programmer user.

## Commands

### /learn start

1. Check if the lwb server is already running:
   ```bash
   curl -s http://127.0.0.1:3579/health 2>/dev/null
   ```

2. If NOT running, start the server in the background:
   ```bash
   lwb serve &
   ```

3. Detect the terminal and set up the teaching pane:
   - If inside tmux (`$TMUX` is set): run `tmux split-window -h "lwb watch"`
   - Otherwise: tell the user:
     > 请手动分屏（Warp 按 Cmd+D，Ghostty 按 Cmd+D），然后在新 pane 运行：
     > ```
     > lwb watch
     > ```

4. Register the PostToolUse hook by adding to `.claude/settings.local.json`:
   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "hooks": [
             {
               "type": "http",
               "url": "http://127.0.0.1:3579/event",
               "timeout": 5
             }
           ]
         }
       ]
     }
   }
   ```

5. Confirm to the user:
   > 教学模式已启动！我在编码的同时，右侧面板会实时解释每一步操作。

### /learn stop

1. Remove the PostToolUse hook from `.claude/settings.local.json`
2. Stop the lwb server:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/shutdown 2>/dev/null
   ```
3. Confirm: 教学模式已关闭。
```

- [ ] **Step 2: Commit**

```bash
git add src/skill/learn.md
git commit -m "feat: add /learn skill definition for Claude Code"
```

---

## Task 12: Integration Test — End to End

**Files:**
- Create: `tests/integration.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// tests/integration.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { createServer } from "../src/server/index.js";
import type { FastifyInstance } from "fastify";

describe("Server integration", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("health check returns ok", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("rejects invalid hook events", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/event",
      payload: { invalid: true },
    });

    expect(response.statusCode).toBe(400);
  });

  it("accepts valid hook events", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/event",
      payload: {
        session_id: "s1",
        hook_event_name: "PostToolUse",
        tool_name: "Read",
        tool_input: { file_path: "/src/index.ts" },
        tool_response: { content: "hello" },
        tool_use_id: "t1",
        cwd: "/project",
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
npx vitest run tests/integration.test.ts
```

Expected: All 3 tests PASS (note: the LLM call test will use the real API or may need ANTHROPIC_API_KEY — if not set, the processEvent will catch the error and broadcast a status message, which is acceptable).

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Full build**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: add server integration tests"
```

---

## Task 13: Final Verification and README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# Learn While Building

在使用 Claude Code 编程的同时，实时学习编程概念。

## 安装

```bash
npm install -g learn-while-building
```

## 使用方法

在 Claude Code 中输入：

```
/learn start
```

系统会自动：
1. 启动教学服务
2. 在终端分屏中打开教学面板（tmux 自动分屏，其他终端需手动 Cmd+D）
3. 注册 Claude Code hook

之后 Claude Code 每执行一步操作，右侧面板都会实时显示：
- 这一步做了什么（通俗解释）
- 涉及哪些编程概念
- 为什么 AI 选择这样做

停止教学模式：

```
/learn stop
```

## 环境要求

- Node.js >= 18
- Claude Code
- Anthropic API Key（设置 `ANTHROPIC_API_KEY` 环境变量）

## 开发

```bash
git clone <repo>
cd learn-while-building
npm install
npm run build
npm link

# 运行测试
npm test
```

## License

MIT
```

- [ ] **Step 2: Build and link for local testing**

```bash
npm run build && npm link
```

- [ ] **Step 3: Verify lwb command works**

```bash
lwb
```

Expected: Shows help text with `serve` and `watch` commands.

- [ ] **Step 4: Run final test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```
