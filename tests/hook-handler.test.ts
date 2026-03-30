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
