// tests/trigger.test.ts
import { describe, it, expect } from "vitest";
import { shouldTriggerExercise } from "../src/teaching/trigger.js";
import type { KnowledgeStore } from "../src/types.js";

describe("shouldTriggerExercise", () => {
  it("triggers when a new concept appears (level 0)", () => {
    const knowledge: KnowledgeStore = { concepts: {} };
    const teachingConcepts = [{ name: "async", label: "Async", level: 1 as const }];
    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(true);
  });

  it("triggers when weak concept has 3+ encounters", () => {
    const knowledge: KnowledgeStore = {
      concepts: { promise: { level: 1, encounters: 3, lastSeen: "2026-03-30" } },
    };
    const teachingConcepts = [{ name: "promise", label: "Promise", level: 1 as const }];
    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(true);
  });

  it("does not trigger when all concepts are mastered", () => {
    const knowledge: KnowledgeStore = {
      concepts: { variable: { level: 3, encounters: 20, lastSeen: "2026-03-30" } },
    };
    const teachingConcepts = [{ name: "variable", label: "Variable", level: 3 as const }];
    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(false);
  });

  it("does not trigger when weak concept has fewer than 3 encounters", () => {
    const knowledge: KnowledgeStore = {
      concepts: { loop: { level: 1, encounters: 2, lastSeen: "2026-03-30" } },
    };
    const teachingConcepts = [{ name: "loop", label: "Loop", level: 1 as const }];
    expect(shouldTriggerExercise(knowledge, teachingConcepts, false)).toBe(false);
  });

  it("does not trigger when teaching used a static template", () => {
    const knowledge: KnowledgeStore = { concepts: {} };
    const teachingConcepts = [{ name: "terminal_command", label: "Terminal Command", level: 1 as const }];
    expect(shouldTriggerExercise(knowledge, teachingConcepts, true)).toBe(false);
  });

  it("does not trigger when no concepts in teaching content", () => {
    const knowledge: KnowledgeStore = { concepts: {} };
    expect(shouldTriggerExercise(knowledge, [], false)).toBe(false);
  });
});
