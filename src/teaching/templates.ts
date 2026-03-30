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
    ls: "查看文件夹里有哪些文件和子文件夹，就像打开抽屉看看里面有什么。",
    cd: "切换到另一个文件夹，就像走进另一个房间。",
    pwd: "显示当前所在的文件夹路径，就像查看你在地图上的位置。",
    mkdir: "创建一个新的文件夹，就像在柜子里加一个新抽屉。",
    cat: "显示一个文件的全部内容。",
    echo: "在终端打印一段文字。",
    clear: "清空终端屏幕，让界面更整洁。",
    which: "查找一个命令安装在哪个位置。",
    whoami: "显示当前登录的用户名。",
  };

  return {
    type: "teaching",
    title: `执行命令: ${cmd}`,
    explanation: descriptions[firstWord] ?? `执行了 ${firstWord} 命令。`,
    concepts: [{ name: "terminal_command", label: "终端命令", level: 1 }],
    reasoning: "AI 在用终端命令来了解或整理项目的文件结构。",
  };
}

const rules: ReadonlyArray<TemplateRule> = [
  {
    tool: "Bash",
    match: isBashSimple,
    generate: bashTemplate,
  },
  {
    tool: "Read",
    match: () => true,
    generate: (input) => ({
      type: "teaching",
      title: `读取文件: ${String(input.file_path ?? "").split("/").pop()}`,
      explanation: "AI 正在阅读一个文件的内容，了解里面写了什么，就像翻开一页纸看看上面的内容。",
      concepts: [{ name: "file_read", label: "读取文件", level: 1 }],
      reasoning: "AI 需要先了解现有代码，才能做出合适的修改。",
    }),
  },
  {
    tool: "Glob",
    match: () => true,
    generate: (input) => ({
      type: "teaching",
      title: `搜索文件: ${String(input.pattern ?? "")}`,
      explanation: "AI 正在按名称模式搜索文件，就像在文件柜里按标签找文件。",
      concepts: [{ name: "file_search", label: "文件搜索", level: 1 }],
      reasoning: "AI 需要找到相关的文件才能继续工作。",
    }),
  },
  {
    tool: "Grep",
    match: () => true,
    generate: (input) => ({
      type: "teaching",
      title: `搜索内容: "${String(input.pattern ?? "")}"`,
      explanation: "AI 正在搜索文件内容中包含特定文字的地方，就像在一本书里搜索关键词。",
      concepts: [{ name: "content_search", label: "内容搜索", level: 1 }],
      reasoning: "AI 在查找代码中某个关键词出现的位置，以便理解代码结构。",
    }),
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
