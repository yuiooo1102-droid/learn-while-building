import { describe, it, expect, vi } from "vitest";
import { generateTeaching, buildPrompt } from "../src/teaching/generator.js";
import type { HookEvent, KnowledgeStore, SessionStep } from "../src/types.js";

describe("buildPrompt", () => {
  it("includes code content for Write tool", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "/src/index.ts", content: "import express from 'express';\nconst app = express();" },
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

    expect(prompt).toContain("import express");
    expect(prompt).toContain("const app");
    expect(prompt).toContain("index.ts");
    expect(prompt).toContain("variable");
    expect(prompt).toContain("mastered");
    expect(prompt).toContain("programming concepts");
  });

  it("includes diff content for Edit tool", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/src/app.ts", old_string: "let x = 1", new_string: "const x = 1" },
      tool_response: { success: true },
      tool_use_id: "t2",
      cwd: "/project",
    };

    const prompt = buildPrompt(event, { concepts: {} }, []);

    expect(prompt).toContain("let x = 1");
    expect(prompt).toContain("const x = 1");
    expect(prompt).toContain("Before");
    expect(prompt).toContain("After");
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
    expect(prompt).toContain("npm install react");
    expect(prompt).toContain("Run command");
  });

  it("adjusts verbosity for depth 1 (brief)", () => {
    const event: HookEvent = {
      session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Write",
      tool_input: { file_path: "/src/app.ts", content: "const x = 1;" },
      tool_response: { success: true }, tool_use_id: "t1", cwd: "/project",
    };
    const prompt = buildPrompt(event, { concepts: {} }, [], 1);
    expect(prompt).toContain("80 words");
  });

  it("adjusts verbosity for depth 3 (detailed)", () => {
    const event: HookEvent = {
      session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Write",
      tool_input: { file_path: "/src/app.ts", content: "const x = 1;" },
      tool_response: { success: true }, tool_use_id: "t1", cwd: "/project",
    };
    const prompt = buildPrompt(event, { concepts: {} }, [], 3);
    expect(prompt).toContain("400 words");
  });
});

describe("generateTeaching", () => {
  it("calls Anthropic API with provided model and returns parsed content", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "Install React",
            explanation: "A UI framework",
            concepts: [{ name: "npm_install", label: "Package Install", level: 1 }],
            reasoning: "Project needs React to build the interface",
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
    expect(result.title).toBe("Install React");
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-6");
  });
});
