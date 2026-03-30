import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendArchive, loadArchive, filterByConcept } from "../src/teaching/archive.js";
import type { ArchiveEntry } from "../src/types.js";

const TEST_DIR = join(import.meta.dirname, ".tmp-archive-test");
const TEST_PATH = join(TEST_DIR, "archive.jsonl");

beforeEach(async () => { await mkdir(TEST_DIR, { recursive: true }); });
afterEach(async () => { await rm(TEST_DIR, { recursive: true, force: true }); });

const ENTRY_A: ArchiveEntry = {
  timestamp: "2026-03-30T12:00:00Z", project: "/project/a",
  concepts: ["variable", "function"], title: "声明变量和函数",
  explanation: "变量是盒子，函数是配方", reasoning: "需要存储数据和定义逻辑",
};
const ENTRY_B: ArchiveEntry = {
  timestamp: "2026-03-30T12:01:00Z", project: "/project/a",
  concepts: ["async_await", "promise"], title: "异步编程",
  explanation: "异步就像点外卖", reasoning: "需要等待网络请求",
};

describe("appendArchive", () => {
  it("creates file and appends entry", async () => {
    await appendArchive(TEST_PATH, ENTRY_A);
    const raw = await readFile(TEST_PATH, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).title).toBe("声明变量和函数");
  });
  it("appends multiple entries as separate lines", async () => {
    await appendArchive(TEST_PATH, ENTRY_A);
    await appendArchive(TEST_PATH, ENTRY_B);
    const raw = await readFile(TEST_PATH, "utf-8");
    expect(raw.trim().split("\n")).toHaveLength(2);
  });
});

describe("loadArchive", () => {
  it("returns empty array when file does not exist", async () => {
    expect(await loadArchive(TEST_PATH)).toEqual([]);
  });
  it("loads all entries from JSONL file", async () => {
    await appendArchive(TEST_PATH, ENTRY_A);
    await appendArchive(TEST_PATH, ENTRY_B);
    const entries = await loadArchive(TEST_PATH);
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe("声明变量和函数");
  });
  it("skips malformed lines", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, `${JSON.stringify(ENTRY_A)}\nbad json\n${JSON.stringify(ENTRY_B)}\n`);
    expect(await loadArchive(TEST_PATH)).toHaveLength(2);
  });
});

describe("filterByConcept", () => {
  it("filters entries by concept name", () => {
    const result = filterByConcept([ENTRY_A, ENTRY_B], "variable");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("声明变量和函数");
  });
  it("returns empty array when no match", () => {
    expect(filterByConcept([ENTRY_A, ENTRY_B], "decorator")).toEqual([]);
  });
});
