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

  it("returns false for Glob, Grep, Read tools (now handled by LLM)", () => {
    expect(hasTemplate("Glob", { pattern: "**/*.ts" })).toBe(false);
    expect(hasTemplate("Grep", { pattern: "import" })).toBe(false);
    expect(hasTemplate("Read", { file_path: "/src/index.ts" })).toBe(false);
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
