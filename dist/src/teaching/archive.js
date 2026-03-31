import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export async function appendArchive(filePath, entry) {
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, JSON.stringify(entry) + "\n");
}
export async function loadArchive(filePath) {
    try {
        const raw = await readFile(filePath, "utf-8");
        const lines = raw.trim().split("\n").filter(Boolean);
        const entries = [];
        for (const line of lines) {
            try {
                entries.push(JSON.parse(line));
            }
            catch { }
        }
        return entries;
    }
    catch {
        return [];
    }
}
export function filterByConcept(entries, concept) {
    return entries.filter((e) => e.concepts.includes(concept));
}
//# sourceMappingURL=archive.js.map