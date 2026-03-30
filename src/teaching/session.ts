import type { SessionStep } from "../types.js";

export type Session = {
  readonly steps: ReadonlyArray<SessionStep>;
  readonly maxSteps: number;
};

export function createSession(maxSteps: number = 10): Session {
  return { steps: [], maxSteps };
}

export function addStep(session: Session, step: SessionStep): Session {
  const newSteps = [...session.steps, step];
  const trimmed =
    newSteps.length > session.maxSteps
      ? newSteps.slice(newSteps.length - session.maxSteps)
      : newSteps;

  return { steps: trimmed, maxSteps: session.maxSteps };
}

export function getRecentSteps(
  session: Session,
  count: number,
): ReadonlyArray<SessionStep> {
  return session.steps.slice(-count);
}
