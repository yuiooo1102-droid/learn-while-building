import type { SessionStep } from "../types.js";
export type Session = {
    readonly steps: ReadonlyArray<SessionStep>;
    readonly maxSteps: number;
};
export declare function createSession(maxSteps?: number): Session;
export declare function addStep(session: Session, step: SessionStep): Session;
export declare function getRecentSteps(session: Session, count: number): ReadonlyArray<SessionStep>;
