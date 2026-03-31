import type { KnowledgeStore, ConceptLevel } from "../types.js";
export declare function loadKnowledge(filePath: string): Promise<KnowledgeStore>;
export declare function saveKnowledge(filePath: string, store: KnowledgeStore): Promise<void>;
export declare function updateConcept(store: KnowledgeStore, conceptName: string, newLevel?: ConceptLevel): KnowledgeStore;
export declare function getConceptLevel(store: KnowledgeStore, conceptName: string): ConceptLevel;
