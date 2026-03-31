import { describe, it, expect, vi } from "vitest";
import { generateExercise, judgeAnswer, buildExercisePrompt, buildJudgePrompt } from "../src/teaching/exercise.js";
import type { HookEvent, KnowledgeStore, SessionStep } from "../src/types.js";

const MOCK_EVENT: HookEvent = {
  session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Write",
  tool_input: { file_path: "/src/app.ts", content: "const x = 1;" },
  tool_response: { success: true }, tool_use_id: "t1", cwd: "/project",
};

const MOCK_KNOWLEDGE: KnowledgeStore = {
  concepts: { variable: { level: 1, encounters: 3, lastSeen: "2026-03-30" } },
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
    const exercise = { type: "exercise" as const, question: "What is a variable?", options: ["A box", "A function", "A loop"] };
    const prompt = buildJudgePrompt(exercise, "A box", MOCK_EVENT);
    expect(prompt).toContain("What is a variable?");
    expect(prompt).toContain("A box");
  });
});

describe("generateExercise", () => {
  it("calls LLM and returns parsed exercise", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ question: "What is the value of variable x?", options: ["1", "2", "undefined"], hint: "Look at the assignment statement" }) }],
    });
    const mockClient = { messages: { create: mockCreate } };

    const result = await generateExercise(mockClient as any, MOCK_EVENT, MOCK_KNOWLEDGE, MOCK_STEPS, "claude-sonnet-4-6");
    expect(result.type).toBe("exercise");
    expect(result.question).toBe("What is the value of variable x?");
    expect(result.options).toHaveLength(3);
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });
});

describe("judgeAnswer", () => {
  it("calls LLM and returns feedback with concept updates", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ correct: true, explanation: "Correct!", conceptUpdates: [{ name: "variable", newLevel: 2 }] }) }],
    });
    const mockClient = { messages: { create: mockCreate } };
    const exercise = { type: "exercise" as const, question: "What is the value of variable x?", options: ["1", "2", "undefined"] };

    const result = await judgeAnswer(mockClient as any, exercise, "1", MOCK_EVENT, "claude-sonnet-4-6");
    expect(result.type).toBe("feedback");
    expect(result.correct).toBe(true);
    expect(result.conceptUpdates).toHaveLength(1);
    expect(result.conceptUpdates[0].newLevel).toBe(2);
  });
});
