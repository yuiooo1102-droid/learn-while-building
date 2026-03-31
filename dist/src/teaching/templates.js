const SIMPLE_BASH_COMMANDS = ["ls", "cd", "pwd", "mkdir", "cat", "echo", "clear", "which", "whoami"];
function isBashSimple(input) {
    const cmd = String(input.command ?? "").trim();
    const firstWord = cmd.split(/\s/)[0];
    return SIMPLE_BASH_COMMANDS.includes(firstWord);
}
function bashTemplate(input) {
    const cmd = String(input.command ?? "").trim();
    const firstWord = cmd.split(/\s/)[0];
    const descriptions = {
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
    const friendlyTitle = {
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
const rules = [
    {
        tool: "Bash",
        match: isBashSimple,
        generate: bashTemplate,
    },
];
export function hasTemplate(toolName, toolInput) {
    return rules.some((r) => r.tool === toolName && r.match(toolInput));
}
export function getTemplate(toolName, toolInput) {
    const rule = rules.find((r) => r.tool === toolName && r.match(toolInput));
    return rule ? rule.generate(toolInput) : null;
}
//# sourceMappingURL=templates.js.map