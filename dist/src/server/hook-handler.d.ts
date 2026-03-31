import type { HookEvent } from "../types.js";
export declare function parseHookEvent(body: unknown): HookEvent | null;
export type Debouncer<T> = {
    push: (event: T, handler: (event: T) => void) => void;
};
export declare function createDebouncer<T>(delayMs: number): Debouncer<T>;
