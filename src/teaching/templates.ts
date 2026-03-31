import type { TeachingContent } from "../types.js";

type TemplateRule = {
  readonly tool: string;
  readonly match: (input: Record<string, unknown>) => boolean;
  readonly generate: (input: Record<string, unknown>) => TeachingContent;
};

const SIMPLE_BASH_COMMANDS = ["ls", "cd", "pwd", "mkdir", "cat", "echo", "clear", "which", "whoami"];

function isBashSimple(input: Record<string, unknown>): boolean {
  const cmd = String(input.command ?? "").trim();
  const firstWord = cmd.split(/\s/)[0];
  return SIMPLE_BASH_COMMANDS.includes(firstWord);
}

function bashTemplate(input: Record<string, unknown>): TeachingContent {
  const cmd = String(input.command ?? "").trim();
  const firstWord = cmd.split(/\s/)[0];

  const descriptions: Record<string, string> = {
    ls: "List files and subdirectories in a folder, like opening a drawer to see what's inside.",
    cd: "Switch to another folder, like walking into a different room.",
    pwd: "Show the current folder path, like checking your position on a map.",
    mkdir: "Create a new folder, like adding a new drawer to a cabinet.",
    cat: "Display the full contents of a file.",
    echo: "Print a line of text to the terminal.",
    clear: "Clear the terminal screen to tidy up the display.",
    which: "Find where a command is installed on the system.",
    whoami: "Show the currently logged-in username.",
  };

  const friendlyTitle: Record<string, string> = {
    ls: "Browsing folder contents",
    cd: "Navigating to a folder",
    pwd: "Checking current location",
    mkdir: "Creating a new folder",
    cat: "Reading a file",
    echo: "Printing text",
    clear: "Clearing the screen",
    which: "Locating a tool",
    whoami: "Checking current user",
  };

  return {
    type: "teaching",
    title: friendlyTitle[firstWord] ?? `Running ${firstWord}`,
    explanation: descriptions[firstWord] ?? `Ran the ${firstWord} command.`,
    concepts: [{ name: "terminal_command", label: "Terminal Command", level: 1 }],
    reasoning: "The AI is using terminal commands to explore or organize the project file structure.",
  };
}

const rules: ReadonlyArray<TemplateRule> = [
  {
    tool: "Bash",
    match: isBashSimple,
    generate: bashTemplate,
  },
];

export function hasTemplate(
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  return rules.some((r) => r.tool === toolName && r.match(toolInput));
}

export function getTemplate(
  toolName: string,
  toolInput: Record<string, unknown>,
): TeachingContent | null {
  const rule = rules.find((r) => r.tool === toolName && r.match(toolInput));
  return rule ? rule.generate(toolInput) : null;
}
