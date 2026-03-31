import type { ArchiveEntry } from "../types.js";
export declare function appendArchive(filePath: string, entry: ArchiveEntry): Promise<void>;
export declare function loadArchive(filePath: string): Promise<ReadonlyArray<ArchiveEntry>>;
export declare function filterByConcept(entries: ReadonlyArray<ArchiveEntry>, concept: string): ReadonlyArray<ArchiveEntry>;
