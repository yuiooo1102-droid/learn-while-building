# v0.2 Exercise System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive exercise system to the real-time teaching companion — smart triggering based on concept mastery, LLM-generated exercises with answer judging, and user-configurable model selection.

**Architecture:** New modules (trigger, exercise, config) plug into the existing Fastify server's processEvent pipeline. The trigger engine is a pure function that checks knowledge state. Exercise generation and judging use the Anthropic SDK with a user-configurable model (default Sonnet). The Ink watch client gains exercise/feedback views and bidirectional WebSocket communication for answer submission.

**Tech Stack:** TypeScript (ESM), Fastify, ws (WebSocket), Ink 5 + React 18, Anthropic SDK, Vitest

---

## File Map

```
Changes to existing files:
  src/types.ts                    — Add Exercise, ExerciseFeedback, LwbConfig, expand WatchMessage
  src/teaching/generator.ts       — Accept model parameter instead of hardcoded haiku
  src/server/index.ts             — Add trigger check, exercise endpoints, WebSocket answer handling, config endpoints
  src/watch/app.tsx               — Add exercise/feedback states, bidirectional WebSocket
  src/skill/learn.md              — Add /learn try and /learn model commands

New files:
  src/teaching/config.ts          — Config read/write (model selection)
  src/teaching/trigger.ts         — Pure function: should we trigger an exercise?
  src/teaching/exercise.ts        — Exercise generation + answer judging via LLM
  src/watch/exercise-view.tsx     — Exercise display + input component
  tests/config.test.ts
  tests/trigger.test.ts
  tests/exercise.test.ts
```

---

## Task 1: Expand Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new types to src/types.ts**

Add the following after the existing `WatchMessage` type (line 39):

```ts
export type Exercise = {
  readonly type: "exercise";
  readonly question: string;
  readonly options?: ReadonlyArray<string>;
  readonly hint?: string;
};

export type ExerciseFeedback = {
  readonly type: "feedback";
  readonly correct: boolean;
  readonly explanation: string;
  readonly conceptUpdates: ReadonlyArray<{
    readonly name: string;
    readonly newLevel: ConceptLevel;
  }>;
};

export type LwbConfig = {
  readonly model: string;
};

export type ClientMessage = {
  readonly type: "answer";
  readonly answer: string;
};
```

Then update the existing `WatchMessage` type to include the new message types:

```ts
export type WatchMessage =
  | TeachingContent
  | Exercise
  | ExerciseFeedback
  | { readonly type: "status"; readonly message: string }
  | { readonly type: "loading"; readonly title: string };
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Exercise, ExerciseFeedback, LwbConfig, ClientMessage types"
```

---

## Task 2: Config Module

**Files:**
- Create: `src/teaching/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../src/teaching/config.js";

const TEST_DIR = join(import.meta.dirname, ".tmp-config-test");
const TEST_PATH = join(TEST_DIR, "config.json");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns default config when file does not exist", async () => {
    const config = await loadConfig(TEST_PATH);
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(config.model).toBe("claude-sonnet-4-6");
  });

  it("reads existing config file", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, JSON.stringify({ model: "claude-haiku-4-5-20251001" }));
    const config = await loadConfig(TEST_PATH);
    expect(config.model).toBe("claude-haiku-4-5-20251001");
  });

  it("returns default for corrupted file", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, "not json");
    const config = await loadConfig(TEST_PATH);
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe("saveConfig", () => {
  it("writes config to file", async () => {
    const config = { model: "claude-opus-4-6" };
    await saveConfig(TEST_PATH, config);
    const raw = await readFile(TEST_PATH, "utf-8");
    expect(JSON.parse(raw)).toEqual(config);
  });

  it("creates parent directory if needed", async () => {
    const nestedPath = join(TEST_DIR, "nested", "config.json");
    await saveConfig(nestedPath, DEFAULT_CONFIG);
    const raw = await readFile(nestedPath, "utf-8");
    expect(JSON.parse(raw).model).toBe("claude-sonnet-4-6");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/teaching/config.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { LwbConfig } from "../types.js";

export const DEFAULT_CONFIG: LwbConfig = {
  model: "claude-sonnet-4-6",
};

export async function loadConfig(filePath: string): Promise<LwbConfig> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(
  filePath: string,
  config: LwbConfig,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/config.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teaching/config.ts tests/config.test.ts
git commit -m "feat: add config module with model selection"
```

---

## Task 3: Trigger Engine

**Files:**
- Create: `src/teaching/trigger.ts`
- Create: `tests/trigger.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/trigger.test.ts
import { describe, it, expect } from "vitest";
import { shouldTriggerExercise } from "../src/teaching/trigger.js";
import type { KnowledgeStore, TeachingContent } from "../src/types.js";

describe("shouldTriggerExercise", () => {
  it("triggers when a new concept appears (level 0)", () => {
    const knowledge: KnowledgeStore = { concepts: {} };
    const teachingConcepts = [{ name: "async", label: "异步", level: 1 as const }];

    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(true);
  });

  it("triggers when weak concept has 3+ encounters", () => {
    const knowledge: KnowledgeStore = {
      concepts: {
        promise: { level: 1, encounters: 3, lastSeen: "2026-03-30" },
      },
    };
    const teachingConcepts = [{ name: "promise", label: "Promise", level: 1 as const }];

    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(true);
  });

  it("does not trigger when all concepts are mastered", () => {
    const knowledge: KnowledgeStore = {
      concepts: {
        variable: { level: 3, encounters: 20, lastSeen: "2026-03-30" },
      },
    };
    const teachingConcepts = [{ name: "variable", label: "变量", level: 3 as const }];

    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(false);
  });

  it("does not trigger when weak concept has fewer than 3 encounters", () => {
    const knowledge: KnowledgeStore = {
      concepts: {
        loop: { level: 1, encounters: 2, lastSeen: "2026-03-30" },
      },
    };
    const teachingConcepts = [{ name: "loop", label: "循环", level: 1 as const }];

    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(false);
  });

  it("does not trigger when teaching used a static template", () => {
    const knowledge: KnowledgeStore = { concepts: {} };
    const teachingConcepts = [{ name: "terminal_command", label: "终端命令", level: 1 as const }];

    expect(shouldTriggerExercise(knowledge, teachingConcepts, true)).toBe(false);
  });

  it("does not trigger when no concepts in teaching content", () => {
    const knowledge: KnowledgeStore = { concepts: {} };

    expect(shouldTriggerExercise(knowledge, [], false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/trigger.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/teaching/trigger.ts
import type { KnowledgeStore, ConceptLevel } from "../types.js";

type TeachingConcept = {
  readonly name: string;
  readonly label: string;
  readonly level: ConceptLevel;
};

export function shouldTriggerExercise(
  knowledge: KnowledgeStore,
  teachingConcepts: ReadonlyArray<TeachingConcept>,
  usedStaticTemplate: boolean,
): boolean {
  if (usedStaticTemplate) return false;
  if (teachingConcepts.length === 0) return false;

  for (const concept of teachingConcepts) {
    const existing = knowledge.concepts[concept.name];

    // New concept (never seen before)
    if (!existing) return true;

    // Weak concept with enough encounters to warrant practice
    if (existing.level < 2 && existing.encounters >= 3) return true;
  }

  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/trigger.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teaching/trigger.ts tests/trigger.test.ts
git commit -m "feat: add concept-driven exercise trigger engine"
```

---

## Task 4: Exercise Generation and Judging

**Files:**
- Create: `src/teaching/exercise.ts`
- Create: `tests/exercise.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/exercise.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  generateExercise,
  judgeAnswer,
  buildExercisePrompt,
  buildJudgePrompt,
} from "../src/teaching/exercise.js";
import type { HookEvent, KnowledgeStore, SessionStep } from "../src/types.js";

const MOCK_EVENT: HookEvent = {
  session_id: "s1",
  hook_event_name: "PostToolUse",
  tool_name: "Write",
  tool_input: { file_path: "/src/app.ts", content: "const x = 1;" },
  tool_response: { success: true },
  tool_use_id: "t1",
  cwd: "/project",
};

const MOCK_KNOWLEDGE: KnowledgeStore = {
  concepts: {
    variable: { level: 1, encounters: 3, lastSeen: "2026-03-30" },
  },
};

const MOCK_STEPS: ReadonlyArray<SessionStep> = [
  { toolName: "Bash", summary: "npm init", timestamp: "12:00" },
];

describe("buildExercisePrompt", () => {
  it("includes event tool name and knowledge state", () => {
    const prompt = buildExercisePrompt(MOCK_EVENT, MOCK_KNOWLEDGE, MOCK_STEPS);
    expect(prompt).toContain("Write");
    expect(prompt).toContain("variable");
    expect(prompt).toContain("JSON");
  });
});

describe("buildJudgePrompt", () => {
  it("includes question and user answer", () => {
    const exercise = {
      type: "exercise" as const,
      question: "What is a variable?",
      options: ["A box", "A function", "A loop"],
    };
    const prompt = buildJudgePrompt(exercise, "A box", MOCK_EVENT);
    expect(prompt).toContain("What is a variable?");
    expect(prompt).toContain("A box");
  });
});

describe("generateExercise", () => {
  it("calls LLM and returns parsed exercise", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            question: "变量 x 的值是什么？",
            options: ["1", "2", "undefined"],
            hint: "看看赋值语句",
          }),
        },
      ],
    });

    const mockClient = { messages: { create: mockCreate } };

    const result = await generateExercise(
      mockClient as any,
      MOCK_EVENT,
      MOCK_KNOWLEDGE,
      MOCK_STEPS,
      "claude-sonnet-4-6",
    );

    expect(result.type).toBe("exercise");
    expect(result.question).toBe("变量 x 的值是什么？");
    expect(result.options).toHaveLength(3);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });
});

describe("judgeAnswer", () => {
  it("calls LLM and returns feedback with concept updates", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            correct: true,
            explanation: "没错！变量 x 被赋值为 1。",
            conceptUpdates: [{ name: "variable", newLevel: 2 }],
          }),
        },
      ],
    });

    const mockClient = { messages: { create: mockCreate } };

    const exercise = {
      type: "exercise" as const,
      question: "变量 x 的值是什么？",
      options: ["1", "2", "undefined"],
    };

    const result = await judgeAnswer(
      mockClient as any,
      exercise,
      "1",
      MOCK_EVENT,
      "claude-sonnet-4-6",
    );

    expect(result.type).toBe("feedback");
    expect(result.correct).toBe(true);
    expect(result.conceptUpdates).toHaveLength(1);
    expect(result.conceptUpdates[0].newLevel).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/exercise.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/teaching/exercise.ts
import type Anthropic from "@anthropic-ai/sdk";
import type {
  HookEvent,
  KnowledgeStore,
  SessionStep,
  Exercise,
  ExerciseFeedback,
  ConceptLevel,
} from "../types.js";

const LEVEL_LABELS: Record<number, string> = {
  0: "未接触",
  1: "见过",
  2: "理解",
  3: "已掌握",
};

export function buildExercisePrompt(
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
): string {
  const conceptEntries = Object.entries(knowledge.concepts);
  const knowledgeSection =
    conceptEntries.length > 0
      ? conceptEntries
          .map(([name, state]) => `- ${name}: ${LEVEL_LABELS[state.level]} (遇到${state.encounters}次)`)
          .join("\n")
      : "- (暂无学习记录)";

  const stepsSection =
    recentSteps.length > 0
      ? recentSteps.map((s) => `- [${s.toolName}] ${s.summary}`).join("\n")
      : "- (这是第一步)";

  const inputStr = JSON.stringify(event.tool_input, null, 2).slice(0, 500);

  return `你是一个编程教师，需要根据 AI 编程助手刚才的操作，出一道练习题来帮助非程序员学习。

当前用户知识状态：
${knowledgeSection}

刚才 AI 执行了以下操作：
- 工具: ${event.tool_name}
- 参数: ${inputStr}

最近几步上下文：
${stepsSection}

请根据用户的知识水平自行决定题目类型和难度。可以出选择题、预测题、修改题等。

严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "question": "题目内容",
  "options": ["选项A", "选项B", "选项C"],
  "hint": "可选提示"
}

规则：
1. options 字段可选，开放式问题可以不提供
2. hint 字段可选
3. 题目要与刚才的操作相关
4. 难度匹配用户当前水平
5. 用中文`;
}

export function buildJudgePrompt(
  exercise: Exercise,
  userAnswer: string,
  event: HookEvent,
): string {
  const optionsStr = exercise.options
    ? exercise.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")
    : "(开放式问题)";

  return `你是一个编程教师，正在评判非程序员学生的练习答案。

题目：${exercise.question}
选项：
${optionsStr}

学生的回答：${userAnswer}

相关操作上下文：
- 工具: ${event.tool_name}
- 参数: ${JSON.stringify(event.tool_input, null, 2).slice(0, 300)}

请评判并严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "correct": true或false,
  "explanation": "解释为什么对或错，用通俗易懂的语言",
  "conceptUpdates": [{"name": "概念英文名", "newLevel": 0到3的数字}]
}

conceptUpdates 规则：
- 回答正确且理解深入：提升相关概念 level
- 回答错误：降低或保持相关概念 level
- newLevel: 0=未接触, 1=见过, 2=理解, 3=已掌握`;
}

export async function generateExercise(
  client: Anthropic,
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
  model: string,
): Promise<Exercise> {
  const prompt = buildExercisePrompt(event, knowledge, recentSteps);

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      type: "exercise",
      question: String(parsed.question ?? ""),
      options: Array.isArray(parsed.options)
        ? parsed.options.map(String)
        : undefined,
      hint: typeof parsed.hint === "string" ? parsed.hint : undefined,
    };
  } catch {
    return {
      type: "exercise",
      question: "刚才 AI 做了什么操作？用你自己的话描述一下。",
    };
  }
}

export async function judgeAnswer(
  client: Anthropic,
  exercise: Exercise,
  userAnswer: string,
  event: HookEvent,
  model: string,
): Promise<ExerciseFeedback> {
  const prompt = buildJudgePrompt(exercise, userAnswer, event);

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      type: "feedback",
      correct: Boolean(parsed.correct),
      explanation: String(parsed.explanation ?? ""),
      conceptUpdates: Array.isArray(parsed.conceptUpdates)
        ? parsed.conceptUpdates.map((u: Record<string, unknown>) => ({
            name: String(u.name ?? ""),
            newLevel: (Number(u.newLevel) || 0) as ConceptLevel,
          }))
        : [],
    };
  } catch {
    return {
      type: "feedback",
      correct: false,
      explanation: "无法评判答案，请继续学习。",
      conceptUpdates: [],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/exercise.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teaching/exercise.ts tests/exercise.test.ts
git commit -m "feat: add exercise generation and answer judging"
```

---

## Task 5: Update Generator to Use Configurable Model

**Files:**
- Modify: `src/teaching/generator.ts`
- Modify: `tests/generator.test.ts`

- [ ] **Step 1: Update the test to verify model parameter**

Replace the existing `generateTeaching` test in `tests/generator.test.ts`:

```ts
describe("generateTeaching", () => {
  it("calls Anthropic API with provided model and returns parsed content", async () => {
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
      "claude-sonnet-4-6",
    );

    expect(result.type).toBe("teaching");
    expect(result.title).toBe("安装 React");
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-6");
  });
});
```

- [ ] **Step 2: Update generator.ts to accept model parameter**

Change the `generateTeaching` function signature in `src/teaching/generator.ts`:

From:
```ts
export async function generateTeaching(
  client: Anthropic,
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
): Promise<TeachingContent> {
```

To:
```ts
export async function generateTeaching(
  client: Anthropic,
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
  model: string = "claude-sonnet-4-6",
): Promise<TeachingContent> {
```

And change the `client.messages.create` call from:
```ts
    model: "claude-haiku-4-5-20251001",
```
To:
```ts
    model,
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/generator.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/teaching/generator.ts tests/generator.test.ts
git commit -m "refactor: make generator model configurable, default to sonnet"
```

---

## Task 6: Exercise View Component

**Files:**
- Create: `src/watch/exercise-view.tsx`

- [ ] **Step 1: Create exercise-view.tsx**

```tsx
// src/watch/exercise-view.tsx
import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { Exercise, ExerciseFeedback } from "../types.js";

type ExerciseProps = {
  readonly exercise: Exercise;
  readonly inputValue: string;
  readonly onInputChange: (value: string) => void;
  readonly onSubmit: (value: string) => void;
};

export function ExerciseView({
  exercise,
  inputValue,
  onInputChange,
  onSubmit,
}: ExerciseProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="yellow">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
      <Box>
        <Text bold>🎯 试试看！</Text>
      </Box>
      <Box>
        <Text bold color="yellow">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text>{exercise.question}</Text>
      </Box>

      {exercise.options && exercise.options.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {exercise.options.map((opt, i) => (
            <Text key={i}>
              {"  "}{String.fromCharCode(65 + i)}) {opt}
            </Text>
          ))}
        </Box>
      )}

      {exercise.hint && (
        <Box marginTop={1}>
          <Text color="gray">💡 提示: {exercise.hint}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text>输入答案 (输入 skip 跳过): </Text>
        <TextInput
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onSubmit}
        />
      </Box>

      <Box marginTop={1}>
        <Text bold color="yellow">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
    </Box>
  );
}

type FeedbackProps = {
  readonly feedback: ExerciseFeedback;
};

export function FeedbackView({ feedback }: FeedbackProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color={feedback.correct ? "green" : "red"}>
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
      <Box>
        <Text bold>
          {feedback.correct ? "✅ 回答正确！" : "❌ 不太对"}
        </Text>
      </Box>
      <Box>
        <Text bold color={feedback.correct ? "green" : "red"}>
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text>{feedback.explanation}</Text>
      </Box>

      <Box marginTop={1}>
        <Text bold color={feedback.correct ? "green" : "red"}>
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/watch/exercise-view.tsx
git commit -m "feat: add exercise and feedback view components"
```

---

## Task 7: Update Watch Client (app.tsx)

**Files:**
- Modify: `src/watch/app.tsx`

- [ ] **Step 1: Replace app.tsx with exercise-aware version**

```tsx
// src/watch/app.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text } from "ink";
import type {
  WatchMessage,
  TeachingContent,
  Exercise,
  ExerciseFeedback,
} from "../types.js";
import TeachingView from "./teaching-view.js";
import { ExerciseView, FeedbackView } from "./exercise-view.js";

type AppState = "teaching" | "exercise" | "feedback";

type Props = {
  readonly port: number;
};

export default function App({ port }: Props) {
  const [connected, setConnected] = useState(false);
  const [appState, setAppState] = useState<AppState>("teaching");
  const [content, setContent] = useState<TeachingContent | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  const [status, setStatus] = useState<string>("正在连接...");
  const [loading, setLoading] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    wsRef.current = ws;

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
          if (appState === "feedback") {
            setAppState("teaching");
          }
        } else if (msg.type === "exercise") {
          setExercise(msg);
          setInputValue("");
          setAppState("exercise");
          setLoading(null);
        } else if (msg.type === "feedback") {
          setFeedback(msg);
          setAppState("feedback");
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
      wsRef.current = null;
      setStatus("连接已断开");
    };

    return () => ws.close();
  }, [port]);

  const handleSubmit = useCallback(
    (answer: string) => {
      if (!wsRef.current || appState !== "exercise") return;

      if (answer.toLowerCase() === "skip") {
        setAppState("teaching");
        return;
      }

      wsRef.current.send(JSON.stringify({ type: "answer", answer }));
      setInputValue("");
      setLoading("正在评判...");
    },
    [appState],
  );

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

      {!loading && appState === "exercise" && exercise && (
        <ExerciseView
          exercise={exercise}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSubmit}
        />
      )}

      {!loading && appState === "feedback" && feedback && (
        <FeedbackView feedback={feedback} />
      )}

      {!loading && appState === "teaching" && content && (
        <TeachingView content={content} />
      )}

      {!loading && appState === "teaching" && !content && (
        <Box paddingX={1}>
          <Text color="gray">{status}</Text>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/watch/app.tsx
git commit -m "feat: add exercise/feedback states to watch client"
```

---

## Task 8: Update Server with Exercise Pipeline

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: Replace server/index.ts with exercise-aware version**

```ts
// src/server/index.ts
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import type {
  HookEvent,
  WatchMessage,
  Exercise,
  ClientMessage,
} from "../types.js";
import { parseHookEvent, createDebouncer } from "./hook-handler.js";
import { hasTemplate, getTemplate } from "../teaching/templates.js";
import { generateTeaching } from "../teaching/generator.js";
import { generateExercise, judgeAnswer } from "../teaching/exercise.js";
import { shouldTriggerExercise } from "../teaching/trigger.js";
import {
  loadKnowledge,
  saveKnowledge,
  updateConcept,
} from "../teaching/knowledge.js";
import { loadConfig, saveConfig } from "../teaching/config.js";
import { createSession, addStep, getRecentSteps } from "../teaching/session.js";
import { homedir } from "node:os";
import { join } from "node:path";

const LWB_DIR = join(homedir(), ".learn-while-building");
const KNOWLEDGE_PATH = join(LWB_DIR, "knowledge.json");
const CONFIG_PATH = join(LWB_DIR, "config.json");
const PORT = 3579;

export async function createServer() {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);

  const clients = new Set<WebSocket>();
  let session = createSession();
  let knowledge = await loadKnowledge(KNOWLEDGE_PATH);
  let config = await loadConfig(CONFIG_PATH);
  const anthropic = new Anthropic();
  const debouncer = createDebouncer<HookEvent>(300);
  let pendingExercise: Exercise | null = null;
  let lastEvent: HookEvent | null = null;

  function broadcast(message: WatchMessage) {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  async function handleAnswer(answer: string) {
    if (!pendingExercise || !lastEvent) return;

    try {
      const feedback = await judgeAnswer(
        anthropic,
        pendingExercise,
        answer,
        lastEvent,
        config.model,
      );

      broadcast(feedback);

      for (const update of feedback.conceptUpdates) {
        knowledge = updateConcept(knowledge, update.name, update.newLevel);
      }
      await saveKnowledge(KNOWLEDGE_PATH, knowledge);
    } catch (err) {
      broadcast({
        type: "status",
        message: `评判失败: ${String(err)}`,
      });
    }

    pendingExercise = null;
  }

  async function tryTriggerExercise(
    event: HookEvent,
    teachingConcepts: ReadonlyArray<{ name: string; label: string; level: 0 | 1 | 2 | 3 }>,
    usedTemplate: boolean,
  ) {
    if (!shouldTriggerExercise(knowledge, teachingConcepts, usedTemplate)) {
      return;
    }

    try {
      const recentSteps = getRecentSteps(session, 3);
      const exercise = await generateExercise(
        anthropic,
        event,
        knowledge,
        recentSteps,
        config.model,
      );
      pendingExercise = exercise;
      lastEvent = event;
      broadcast(exercise);
    } catch (err) {
      broadcast({
        type: "status",
        message: `练习生成失败: ${String(err)}`,
      });
    }
  }

  async function processEvent(event: HookEvent) {
    const toolInput = event.tool_input as Record<string, unknown>;
    lastEvent = event;

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
        await tryTriggerExercise(event, content.concepts, true);
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
        config.model,
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

      await tryTriggerExercise(event, content.concepts, false);
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

  // Manual exercise trigger
  app.post("/exercise/trigger", async (_request, reply) => {
    const recentSteps = getRecentSteps(session, 1);
    if (recentSteps.length === 0 && !lastEvent) {
      return reply.status(400).send({ error: "No context available" });
    }

    const event = lastEvent ?? {
      session_id: "manual",
      hook_event_name: "Manual",
      tool_name: "Manual",
      tool_input: {},
      tool_response: {},
      tool_use_id: "manual",
      cwd: "",
    };

    try {
      const exercise = await generateExercise(
        anthropic,
        event,
        knowledge,
        getRecentSteps(session, 3),
        config.model,
      );
      pendingExercise = exercise;
      broadcast(exercise);
      return reply.status(200).send();
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  // Config endpoints
  app.get("/config", async () => config);

  app.post<{ Body: { model?: string } }>("/config", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.model === "string") {
      config = { ...config, model: body.model };
      await saveConfig(CONFIG_PATH, config);
    }
    return reply.status(200).send(config);
  });

  // WebSocket endpoint for lwb watch clients
  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(
      JSON.stringify({ type: "status", message: "已连接到教学服务" }),
    );

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as ClientMessage;
        if (msg.type === "answer" && typeof msg.answer === "string") {
          handleAnswer(msg.answer).catch(console.error);
        }
      } catch {
        // Ignore invalid messages
      }
    });

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

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run all existing tests**

Run: `npx vitest run`
Expected: All tests PASS (integration tests should still work).

- [ ] **Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "feat: integrate exercise pipeline into server"
```

---

## Task 9: Update Skill Definition

**Files:**
- Modify: `src/skill/learn.md`
- Modify: `~/.claude/commands/learn.md` (global copy)

- [ ] **Step 1: Update learn.md**

Replace the full contents of `src/skill/learn.md`:

```markdown
---
name: learn
description: Start/stop real-time teaching mode with interactive exercises. Use when user wants to learn programming concepts while Claude Code builds their project.
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
   > 教学模式已启动！我在编码的同时，右侧面板会实时解释每一步操作，还会不定时出练习题帮你巩固。

### /learn stop

1. Remove the PostToolUse hook from `.claude/settings.local.json`
2. Stop the lwb server:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/shutdown 2>/dev/null
   ```
3. Confirm: 教学模式已关闭。

### /learn try

Manually trigger an exercise question:
```bash
curl -s -X POST http://127.0.0.1:3579/exercise/trigger
```
Then tell the user: 已在教学面板中生成一道练习题，请在右侧 pane 作答。

### /learn model <model-id>

Switch the LLM model used for teaching and exercises:
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"model": "<model-id>"}'
```
Then confirm: 已切换模型为 <model-id>。
```

- [ ] **Step 2: Copy to global commands**

```bash
cp src/skill/learn.md ~/.claude/commands/learn.md
```

- [ ] **Step 3: Commit**

```bash
git add src/skill/learn.md
git commit -m "feat: add /learn try and /learn model commands to skill"
```

---

## Task 10: Integration Tests for Exercise System

**Files:**
- Modify: `tests/integration.test.ts`

- [ ] **Step 1: Add exercise-related integration tests**

Append the following tests to the existing `describe("Server integration")` block in `tests/integration.test.ts`:

```ts
  it("returns 400 for manual trigger with no context", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/exercise/trigger",
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns default config", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "GET",
      url: "/config",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.model).toBe("claude-sonnet-4-6");
  });

  it("updates config model", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/config",
      payload: { model: "claude-haiku-4-5-20251001" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().model).toBe("claude-haiku-4-5-20251001");

    // Verify it persisted
    const getResponse = await app.inject({
      method: "GET",
      url: "/config",
    });
    expect(getResponse.json().model).toBe("claude-haiku-4-5-20251001");
  });
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: add integration tests for exercise and config endpoints"
```

---

## Task 11: Rebuild and Verify

**Files:**
- No new files

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: No errors.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 3: Verify lwb command still works**

```bash
lwb
```

Expected: Shows help text.

- [ ] **Step 4: Commit any remaining changes**

```bash
git status
```

If package-lock.json or other files changed:

```bash
git add -A
git commit -m "chore: rebuild for v0.2 exercise system"
```
