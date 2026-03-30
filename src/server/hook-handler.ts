import type { HookEvent } from "../types.js";

export function parseHookEvent(body: unknown): HookEvent | null {
  if (body === null || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  if (
    typeof obj.tool_name !== "string" ||
    typeof obj.tool_use_id !== "string" ||
    typeof obj.cwd !== "string" ||
    typeof obj.session_id !== "string"
  ) {
    return null;
  }

  return {
    session_id: obj.session_id,
    hook_event_name: String(obj.hook_event_name ?? "PostToolUse"),
    tool_name: obj.tool_name,
    tool_input: (obj.tool_input as Record<string, unknown>) ?? {},
    tool_response: (obj.tool_response as Record<string, unknown>) ?? {},
    tool_use_id: obj.tool_use_id,
    cwd: obj.cwd,
    timestamp: new Date().toISOString(),
  };
}

export type Debouncer<T> = {
  push: (event: T, handler: (event: T) => void) => void;
};

export function createDebouncer<T>(delayMs: number): Debouncer<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestEvent: T | null = null;
  let latestHandler: ((event: T) => void) | null = null;

  return {
    push(event: T, handler: (event: T) => void) {
      latestEvent = event;
      latestHandler = handler;

      if (timer !== null) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        if (latestEvent !== null && latestHandler !== null) {
          latestHandler(latestEvent);
        }
        timer = null;
        latestEvent = null;
        latestHandler = null;
      }, delayMs);
    },
  };
}
