import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../src/teaching/config.js";

const TEST_DIR = join(import.meta.dirname, ".tmp-config-test");
const TEST_PATH = join(TEST_DIR, "config.json");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns default config when file does not exist", async () => {
    const config = await loadConfig(TEST_PATH);
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(config.model).toBe("claude-sonnet-4-6");
  });

  it("reads existing config file", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, JSON.stringify({ model: "claude-haiku-4-5-20251001" }));
    const config = await loadConfig(TEST_PATH);
    expect(config.model).toBe("claude-haiku-4-5-20251001");
  });

  it("returns default for corrupted file", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, "not json");
    const config = await loadConfig(TEST_PATH);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("returns default depth when not set", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, JSON.stringify({ model: "claude-sonnet-4-6" }));
    const config = await loadConfig(TEST_PATH);
    expect(config.depth).toBe(2);
  });

  it("reads depth from config file", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(TEST_PATH, JSON.stringify({ model: "claude-sonnet-4-6", depth: 3 }));
    const config = await loadConfig(TEST_PATH);
    expect(config.depth).toBe(3);
  });
});

describe("saveConfig", () => {
  it("writes config to file", async () => {
    const config = { model: "claude-opus-4-6" };
    await saveConfig(TEST_PATH, config);
    const raw = await readFile(TEST_PATH, "utf-8");
    expect(JSON.parse(raw)).toEqual(config);
  });

  it("creates parent directory if needed", async () => {
    const nestedPath = join(TEST_DIR, "nested", "config.json");
    await saveConfig(nestedPath, DEFAULT_CONFIG);
    const raw = await readFile(nestedPath, "utf-8");
    expect(JSON.parse(raw).model).toBe("claude-sonnet-4-6");
  });
});
