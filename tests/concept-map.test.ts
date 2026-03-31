import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConceptMap, saveConceptMap, lookupConcept, insertConcept } from "../src/teaching/concept-map.js";

const TEST_DIR = join(import.meta.dirname, ".tmp-conceptmap-test");
const TEST_PATH = join(TEST_DIR, "concept-map.json");

beforeEach(async () => { await mkdir(TEST_DIR, { recursive: true }); });
afterEach(async () => { await rm(TEST_DIR, { recursive: true, force: true }); });

describe("loadConceptMap", () => {
  it("returns empty store when file does not exist", async () => {
    expect(await loadConceptMap(TEST_PATH)).toEqual({ concepts: {} });
  });
  it("reads existing map file", async () => {
    await writeFile(TEST_PATH, JSON.stringify({ concepts: { variable: { domain: "Basics", category: "Variables" } } }));
    const map = await loadConceptMap(TEST_PATH);
    expect(map.concepts.variable.domain).toBe("Basics");
  });
});

describe("saveConceptMap", () => {
  it("writes store to file", async () => {
    const store = { concepts: { loop: { domain: "Basics", category: "Control Flow" } } };
    await saveConceptMap(TEST_PATH, store);
    const raw = await readFile(TEST_PATH, "utf-8");
    expect(JSON.parse(raw)).toEqual(store);
  });
  it("creates parent directory if missing", async () => {
    const nested = join(TEST_DIR, "nested", "deep", "map.json");
    await saveConceptMap(nested, { concepts: {} });
    const raw = await readFile(nested, "utf-8");
    expect(JSON.parse(raw)).toEqual({ concepts: {} });
  });
});

describe("insertConcept", () => {
  it("adds new concept", () => {
    const updated = insertConcept({ concepts: {} }, "loop", "Basics", "Control Flow");
    expect(updated.concepts.loop).toEqual({ domain: "Basics", category: "Control Flow" });
  });
  it("does not overwrite existing (locked)", () => {
    const map = { concepts: { loop: { domain: "Basics", category: "Control Flow" } } };
    const updated = insertConcept(map, "loop", "Advanced", "Iteration");
    expect(updated.concepts.loop.domain).toBe("Basics");
  });
  it("does not mutate original", () => {
    const map = { concepts: {} };
    insertConcept(map, "loop", "Basics", "Control Flow");
    expect(Object.keys(map.concepts)).toHaveLength(0);
  });
});

describe("lookupConcept", () => {
  it("returns mapping for known concept", () => {
    const map = { concepts: { loop: { domain: "Basics", category: "Control Flow" } } };
    expect(lookupConcept(map, "loop")).toEqual({ domain: "Basics", category: "Control Flow" });
  });
  it("returns null for unknown", () => {
    expect(lookupConcept({ concepts: {} }, "x")).toBeNull();
  });
});
