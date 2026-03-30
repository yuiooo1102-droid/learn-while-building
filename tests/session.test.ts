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
