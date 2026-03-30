// src/teaching/trigger.ts
import type { KnowledgeStore, ConceptLevel } from "../types.js";

type TeachingConcept = {
  readonly name: string;
  readonly label: string;
  readonly level: ConceptLevel;
};

export function shouldTriggerExercise(
  knowledge: KnowledgeStore,
  teachingConcepts: ReadonlyArray<TeachingConcept>,
  usedStaticTemplate: boolean,
): boolean {
  if (usedStaticTemplate) return false;
  if (teachingConcepts.length === 0) return false;

  for (const concept of teachingConcepts) {
    const existing = knowledge.concepts[concept.name];
    if (!existing) return true;
    if (existing.level < 2 && existing.encounters >= 3) return true;
  }

  return false;
}
