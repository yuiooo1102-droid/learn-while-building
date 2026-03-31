import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConceptMapStore, ConceptMapping } from "../types.js";

export async function loadConceptMap(filePath: string): Promise<ConceptMapStore> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as ConceptMapStore;
  } catch {
    return { concepts: {} };
  }
}

export async function saveConceptMap(filePath: string, store: ConceptMapStore): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2));
}

export function lookupConcept(store: ConceptMapStore, conceptName: string): ConceptMapping | null {
  return store.concepts[conceptName] ?? null;
}

export function insertConcept(
  store: ConceptMapStore,
  conceptName: string,
  domain: string,
  category: string
): ConceptMapStore {
  if (store.concepts[conceptName]) return store;
  return { concepts: { ...store.concepts, [conceptName]: { domain, category } } };
}
