import type { TerminalType } from "./detect.js";

const INSTRUCTIONS: Record<string, string> = {
  warp: "请按 Cmd+D 分屏，然后在新 pane 中运行: lwb watch",
  ghostty: "请按 Cmd+D 分屏，然后在新 pane 中运行: lwb watch",
  unknown: "请手动打开一个新的终端窗口，然后运行: lwb watch",
};

export function getManualSplitInstructions(terminal: TerminalType): string {
  return INSTRUCTIONS[terminal] ?? INSTRUCTIONS.unknown;
}
