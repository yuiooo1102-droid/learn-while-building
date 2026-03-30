import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { KnowledgeStore, ConceptLevel } from "../types.js";

export async function loadKnowledge(filePath: string): Promise<KnowledgeStore> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as KnowledgeStore;
  } catch {
    return { concepts: {} };
  }
}

export async function saveKnowledge(
  filePath: string,
  store: KnowledgeStore,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2));
}

export function updateConcept(
  store: KnowledgeStore,
  conceptName: string,
  newLevel?: ConceptLevel,
): KnowledgeStore {
  const existing = store.concepts[conceptName];
  const today = new Date().toISOString().slice(0, 10);

  const updatedConcept = existing
    ? {
        level: newLevel ?? existing.level,
        encounters: existing.encounters + 1,
        lastSeen: today,
      }
    : {
        level: (newLevel ?? 1) as ConceptLevel,
        encounters: 1,
        lastSeen: today,
      };

  return {
    concepts: {
      ...store.concepts,
      [conceptName]: updatedConcept,
    },
  };
}

export function getConceptLevel(
  store: KnowledgeStore,
  conceptName: string,
): ConceptLevel {
  return store.concepts[conceptName]?.level ?? (0 as ConceptLevel);
}
