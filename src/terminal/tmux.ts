import { execSync } from "node:child_process";

export function tmuxSplit(command: string): boolean {
  try {
    execSync(`tmux split-window -h "${command}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
