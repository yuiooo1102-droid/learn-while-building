import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  loadKnowledge,
  saveKnowledge,
  updateConcept,
  getConceptLevel,
} from "../src/teaching/knowledge.js";

const TEST_DIR = join(import.meta.dirname, ".tmp-knowledge-test");
const TEST_PATH = join(TEST_DIR, "knowledge.json");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("loadKnowledge", () => {
  it("returns empty store when file does not exist", async () => {
    const store = await loadKnowledge(TEST_PATH);
    expect(store).toEqual({ concepts: {} });
  });

  it("reads existing knowledge file", async () => {
    const data = { concepts: { variable: { level: 2, encounters: 5, lastSeen: "2026-03-30" } } };
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, JSON.stringify(data));
    const store = await loadKnowledge(TEST_PATH);
    expect(store.concepts.variable.level).toBe(2);
  });
});

describe("saveKnowledge", () => {
  it("writes knowledge to file", async () => {
    const store = { concepts: { loop: { level: 1, encounters: 3, lastSeen: "2026-03-30" } } };
    await saveKnowledge(TEST_PATH, store);
    const raw = await readFile(TEST_PATH, "utf-8");
    expect(JSON.parse(raw)).toEqual(store);
  });
});

describe("updateConcept", () => {
  it("creates new concept at level 1 on first encounter", () => {
    const store = { concepts: {} };
    const updated = updateConcept(store, "variable");
    expect(updated.concepts.variable.level).toBe(1);
    expect(updated.concepts.variable.encounters).toBe(1);
  });

  it("increments encounters without changing level", () => {
    const store = {
      concepts: { variable: { level: 1, encounters: 2, lastSeen: "2026-03-29" } },
    };
    const updated = updateConcept(store, "variable");
    expect(updated.concepts.variable.encounters).toBe(3);
    expect(updated.concepts.variable.level).toBe(1);
  });

  it("does not mutate original store", () => {
    const store = { concepts: {} };
    const updated = updateConcept(store, "variable");
    expect(store.concepts).toEqual({});
    expect(updated.concepts.variable).toBeDefined();
  });
});

describe("getConceptLevel", () => {
  it("returns 0 for unknown concept", () => {
    const store = { concepts: {} };
    expect(getConceptLevel(store, "unknown")).toBe(0);
  });

  it("returns stored level for known concept", () => {
    const store = {
      concepts: { variable: { level: 3, encounters: 10, lastSeen: "2026-03-30" } },
    };
    expect(getConceptLevel(store, "variable")).toBe(3);
  });
});
