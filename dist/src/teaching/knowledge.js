import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export async function loadKnowledge(filePath) {
    try {
        const raw = await readFile(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return { concepts: {} };
    }
}
export async function saveKnowledge(filePath, store) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(store, null, 2));
}
export function updateConcept(store, conceptName, newLevel) {
    const existing = store.concepts[conceptName];
    const today = new Date().toISOString().slice(0, 10);
    const updatedConcept = existing
        ? {
            level: newLevel ?? existing.level,
            encounters: existing.encounters + 1,
            lastSeen: today,
        }
        : {
            level: (newLevel ?? 1),
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
export function getConceptLevel(store, conceptName) {
    return store.concepts[conceptName]?.level ?? 0;
}
//# sourceMappingURL=knowledge.js.map