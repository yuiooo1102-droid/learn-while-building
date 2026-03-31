import type { KnowledgeStore, ConceptLevel } from "../types.js";
type TeachingConcept = {
    readonly name: string;
    readonly label: string;
    readonly level: ConceptLevel;
};
export declare function shouldTriggerExercise(knowledge: KnowledgeStore, teachingConcepts: ReadonlyArray<TeachingConcept>, usedStaticTemplate: boolean): boolean;
export {};
