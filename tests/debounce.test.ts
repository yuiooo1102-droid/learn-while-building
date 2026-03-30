// tests/debounce.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncer } from "../src/server/hook-handler.js";

describe("createDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls handler after delay", async () => {
    const handler = vi.fn();
    const debounced = createDebouncer(300);
    debounced.push("event1", handler);

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledWith("event1");
  });

  it("replaces previous event within debounce window", () => {
    const handler = vi.fn();
    const debounced = createDebouncer(300);
    debounced.push("event1", handler);

    vi.advanceTimersByTime(100);
    debounced.push("event2", handler);

    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("event2");
  });
});
