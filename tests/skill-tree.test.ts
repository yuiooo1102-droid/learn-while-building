import { describe, it, expect } from "vitest";
import { buildSkillTree } from "../src/teaching/skill-tree.js";
import type { ConceptMapStore, KnowledgeStore } from "../src/types.js";

describe("buildSkillTree", () => {
  const conceptMap: ConceptMapStore = {
    concepts: {
      variable: { domain: "Basics", category: "Variables" },
      const_let: { domain: "Basics", category: "Variables" },
      loop: { domain: "Basics", category: "Control Flow" },
      http_request: { domain: "Web", category: "HTTP" },
    },
  };

  it("builds tree with domains as root nodes", () => {
    const knowledge: KnowledgeStore = {
      concepts: {
        variable: { level: 3, encounters: 10, lastSeen: "2026-03-30" },
        const_let: { level: 2, encounters: 5, lastSeen: "2026-03-30" },
        loop: { level: 1, encounters: 2, lastSeen: "2026-03-30" },
        http_request: { level: 0, encounters: 0, lastSeen: "2026-03-30" },
      },
    };
    const tree = buildSkillTree(conceptMap, knowledge);
    expect(tree).toHaveLength(2);
    const basics = tree.find(n => n.name === "Basics");
    expect(basics).toBeDefined();
    expect(basics!.children).toHaveLength(2);
  });

  it("calculates domain progress", () => {
    const knowledge: KnowledgeStore = {
      concepts: {
        variable: { level: 3, encounters: 10, lastSeen: "2026-03-30" },
        const_let: { level: 3, encounters: 5, lastSeen: "2026-03-30" },
        loop: { level: 0, encounters: 0, lastSeen: "2026-03-30" },
      },
    };
    const tree = buildSkillTree(conceptMap, knowledge);
    const basics = tree.find(n => n.name === "Basics")!;
    expect(basics.progress).toBeCloseTo(67, 0);
  });

  it("returns empty tree when no concepts", () => {
    expect(buildSkillTree({ concepts: {} }, { concepts: {} })).toHaveLength(0);
  });
});
