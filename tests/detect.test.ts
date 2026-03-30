// tests/detect.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { detectTerminal } from "../src/terminal/detect.js";

describe("detectTerminal", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("detects tmux", () => {
    process.env.TMUX = "/tmp/tmux-501/default,12345,0";
    expect(detectTerminal()).toBe("tmux");
  });

  it("detects Ghostty on macOS", () => {
    delete process.env.TMUX;
    process.env.GHOSTTY_RESOURCES_DIR = "/Applications/Ghostty.app/Contents/Resources";
    expect(detectTerminal()).toBe("ghostty");
  });

  it("detects Warp", () => {
    delete process.env.TMUX;
    delete process.env.GHOSTTY_RESOURCES_DIR;
    process.env.TERM_PROGRAM = "WarpTerminal";
    expect(detectTerminal()).toBe("warp");
  });

  it("returns unknown for unrecognized terminal", () => {
    delete process.env.TMUX;
    delete process.env.GHOSTTY_RESOURCES_DIR;
    process.env.TERM_PROGRAM = "SomeOther";
    expect(detectTerminal()).toBe("unknown");
  });
});
