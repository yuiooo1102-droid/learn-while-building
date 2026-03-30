import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ArchiveEntry } from "../types.js";

export async function appendArchive(filePath: string, entry: ArchiveEntry): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, JSON.stringify(entry) + "\n");
}

export async function loadArchive(filePath: string): Promise<ReadonlyArray<ArchiveEntry>> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const entries: ArchiveEntry[] = [];
    for (const line of lines) {
      try { entries.push(JSON.parse(line) as ArchiveEntry); } catch {}
    }
    return entries;
  } catch { return []; }
}

export function filterByConcept(
  entries: ReadonlyArray<ArchiveEntry>,
  concept: string,
): ReadonlyArray<ArchiveEntry> {
  return entries.filter((e) => e.concepts.includes(concept));
}
