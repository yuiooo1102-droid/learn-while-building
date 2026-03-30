import { execSync } from "node:child_process";

export function ghosttySplit(command: string): boolean {
  try {
    const script = `
tell application "Ghostty"
  set cfg to new surface configuration with properties {command: "${command}"}
  set t to focused terminal of selected tab of front window
  split t direction right with configuration cfg
end tell`;
    execSync(`osascript -e '${script}'`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
