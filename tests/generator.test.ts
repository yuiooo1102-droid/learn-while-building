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
