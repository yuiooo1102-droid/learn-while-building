export type TerminalType = "tmux" | "ghostty" | "warp" | "unknown";

export function detectTerminal(): TerminalType {
  if (process.env.TMUX) return "tmux";
  if (process.env.GHOSTTY_RESOURCES_DIR) return "ghostty";
  if (process.env.TERM_PROGRAM === "WarpTerminal") return "warp";
  return "unknown";
}
