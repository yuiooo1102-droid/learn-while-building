import type { TerminalType } from "./detect.js";

const INSTRUCTIONS: Record<string, string> = {
  warp: "Press Cmd+D to split, then run in the new pane: lwb watch",
  ghostty: "Press Cmd+D to split, then run in the new pane: lwb watch",
  unknown: "Please open a new terminal window, then run: lwb watch",
};

export function getManualSplitInstructions(terminal: TerminalType): string {
  return INSTRUCTIONS[terminal] ?? INSTRUCTIONS.unknown;
}
