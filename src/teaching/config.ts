import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { LwbConfig } from "../types.js";

export const DEFAULT_CONFIG: LwbConfig = {
  model: "claude-sonnet-4-6",
};

export async function loadConfig(filePath: string): Promise<LwbConfig> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(
  filePath: string,
  config: LwbConfig,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2));
}
