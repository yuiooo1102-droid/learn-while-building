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

    // Should contain the actual code, not just tool name
    expect(prompt).toContain("import express");
    expect(prompt).toContain("const app");
    expect(prompt).toContain("index.ts");
    expect(prompt).toContain("variable");
    expect(prompt).toContain("已掌握");
    expect(prompt).toContain("编程概念");
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
    expect(prompt).toContain("修改前");
    expect(prompt).toContain("修改后");
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
    expect(prompt).toContain("执行命令");
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
      "claude-sonnet-4-6",
    );

    expect(result.type).toBe("teaching");
    expect(result.title).toBe("安装 React");
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-6");
  });
});
