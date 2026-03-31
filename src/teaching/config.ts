import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { LwbConfig, DepthLevel } from "../types.js";

export const DEFAULT_CONFIG: LwbConfig = {
  model: "claude-sonnet-4-6",
  depth: 2,
  lang: "auto",
  goal: "",
  projectType: "auto",
};

function isValidDepth(value: unknown): value is DepthLevel {
  return value === 1 || value === 2 || value === 3;
}

export async function loadConfig(filePath: string): Promise<LwbConfig> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_CONFIG.model,
      depth: isValidDepth(parsed.depth) ? parsed.depth : DEFAULT_CONFIG.depth,
      lang: typeof parsed.lang === "string" ? parsed.lang : DEFAULT_CONFIG.lang,
      goal: typeof parsed.goal === "string" ? parsed.goal : DEFAULT_CONFIG.goal,
      projectType: typeof parsed.projectType === "string" ? parsed.projectType : DEFAULT_CONFIG.projectType,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(filePath: string, config: LwbConfig): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2));
}
