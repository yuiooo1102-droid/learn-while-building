import type { ConceptMapStore, ConceptMapping } from "../types.js";
export declare function loadConceptMap(filePath: string): Promise<ConceptMapStore>;
export declare function saveConceptMap(filePath: string, store: ConceptMapStore): Promise<void>;
export declare function lookupConcept(store: ConceptMapStore, conceptName: string): ConceptMapping | null;
export declare function insertConcept(store: ConceptMapStore, conceptName: string, domain: string, category: string): ConceptMapStore;
