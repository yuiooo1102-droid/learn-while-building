import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export async function loadConceptMap(filePath) {
    try {
        const raw = await readFile(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return { concepts: {} };
    }
}
export async function saveConceptMap(filePath, store) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(store, null, 2));
}
export function lookupConcept(store, conceptName) {
    return store.concepts[conceptName] ?? null;
}
export function insertConcept(store, conceptName, domain, category) {
    if (store.concepts[conceptName])
        return store;
    return { concepts: { ...store.concepts, [conceptName]: { domain, category } } };
}
//# sourceMappingURL=concept-map.js.map