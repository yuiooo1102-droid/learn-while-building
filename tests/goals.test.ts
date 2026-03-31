import { describe, it, expect } from "vitest";
import { GOAL_PRESETS, detectProjectType } from "../src/teaching/goals.js";

describe("GOAL_PRESETS", () => {
  it("has at least 4 presets", () => { expect(GOAL_PRESETS.length).toBeGreaterThanOrEqual(4); });
  it("each has id, label, domains", () => {
    for (const g of GOAL_PRESETS) { expect(g.id).toBeTruthy(); expect(g.label).toBeTruthy(); expect(g.domains.length).toBeGreaterThan(0); }
  });
});

describe("detectProjectType", () => {
  it("detects web frontend", () => { expect(detectProjectType(["package.json"], { dependencies: { react: "^18" } })).toBe("web-frontend"); });
  it("detects web backend", () => { expect(detectProjectType(["package.json"], { dependencies: { fastify: "^4" } })).toBe("web-backend"); });
  it("detects python", () => { expect(detectProjectType(["pyproject.toml"], null)).toBe("python"); });
  it("returns generic for unknown", () => { expect(detectProjectType(["README.md"], null)).toBe("generic"); });
});
