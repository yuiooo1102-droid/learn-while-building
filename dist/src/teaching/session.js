export function createSession(maxSteps = 10) {
    return { steps: [], maxSteps };
}
export function addStep(session, step) {
    const newSteps = [...session.steps, step];
    const trimmed = newSteps.length > session.maxSteps
        ? newSteps.slice(newSteps.length - session.maxSteps)
        : newSteps;
    return { steps: trimmed, maxSteps: session.maxSteps };
}
export function getRecentSteps(session, count) {
    return session.steps.slice(-count);
}
//# sourceMappingURL=session.js.map