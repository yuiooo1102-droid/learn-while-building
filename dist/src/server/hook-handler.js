export function parseHookEvent(body) {
    if (body === null || typeof body !== "object")
        return null;
    const obj = body;
    if (typeof obj.tool_name !== "string" ||
        typeof obj.tool_use_id !== "string" ||
        typeof obj.cwd !== "string" ||
        typeof obj.session_id !== "string") {
        return null;
    }
    return {
        session_id: obj.session_id,
        hook_event_name: String(obj.hook_event_name ?? "PostToolUse"),
        tool_name: obj.tool_name,
        tool_input: obj.tool_input ?? {},
        tool_response: obj.tool_response ?? {},
        tool_use_id: obj.tool_use_id,
        cwd: obj.cwd,
        timestamp: new Date().toISOString(),
    };
}
export function createDebouncer(delayMs) {
    let timer = null;
    let latestEvent = null;
    let latestHandler = null;
    return {
        push(event, handler) {
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
//# sourceMappingURL=hook-handler.js.map