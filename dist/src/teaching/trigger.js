export function shouldTriggerExercise(knowledge, teachingConcepts, usedStaticTemplate) {
    if (usedStaticTemplate)
        return false;
    if (teachingConcepts.length === 0)
        return false;
    for (const concept of teachingConcepts) {
        const existing = knowledge.concepts[concept.name];
        if (!existing)
            return true;
        if (existing.level < 2 && existing.encounters >= 3)
            return true;
    }
    return false;
}
//# sourceMappingURL=trigger.js.map