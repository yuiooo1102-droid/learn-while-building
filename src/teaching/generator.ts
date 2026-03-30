import type Anthropic from "@anthropic-ai/sdk";
import type {
  HookEvent,
  KnowledgeStore,
  SessionStep,
  TeachingContent,
} from "../types.js";

const LEVEL_LABELS: Record<number, string> = {
  0: "未接触",
  1: "见过",
  2: "理解",
  3: "已掌握",
};

export function buildPrompt(
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
): string {
  const conceptEntries = Object.entries(knowledge.concepts);
  const knowledgeSection =
    conceptEntries.length > 0
      ? conceptEntries
          .map(([name, state]) => `- ${name}: ${LEVEL_LABELS[state.level]}`)
          .join("\n")
      : "- (暂无学习记录)";

  const stepsSection =
    recentSteps.length > 0
      ? recentSteps.map((s) => `- [${s.toolName}] ${s.summary}`).join("\n")
      : "- (这是第一步)";

  const toolName = event.tool_name;
  const toolInput = event.tool_input;

  // Extract the most educational content based on tool type
  let codeContent = "";
  let operationContext = "";

  if (toolName === "Write" || toolName === "MultiEdit") {
    codeContent = String(toolInput.content ?? "").slice(0, 1500);
    operationContext = `创建/写入文件: ${String(toolInput.file_path ?? "").split("/").pop()}\n\n代码内容:\n\`\`\`\n${codeContent}\n\`\`\``;
  } else if (toolName === "Edit") {
    const oldStr = String(toolInput.old_string ?? "").slice(0, 500);
    const newStr = String(toolInput.new_string ?? "").slice(0, 500);
    operationContext = `编辑文件: ${String(toolInput.file_path ?? "").split("/").pop()}\n\n修改前:\n\`\`\`\n${oldStr}\n\`\`\`\n\n修改后:\n\`\`\`\n${newStr}\n\`\`\``;
  } else if (toolName === "Bash") {
    const cmd = String(toolInput.command ?? "");
    const output = JSON.stringify(event.tool_response, null, 2).slice(0, 800);
    operationContext = `执行命令: ${cmd}\n\n输出:\n${output}`;
  } else if (toolName === "Read") {
    const fileContent = JSON.stringify(event.tool_response, null, 2).slice(0, 1500);
    operationContext = `读取文件: ${String(toolInput.file_path ?? "").split("/").pop()}\n\n文件内容:\n${fileContent}`;
  } else {
    operationContext = `工具: ${toolName}\n参数: ${JSON.stringify(toolInput, null, 2).slice(0, 800)}`;
  }

  return `你是一个编程教师，正在向一个非程序员实时解释 AI 编程助手写的代码和操作。

你的核心任务不是解释"AI 用了什么工具"，而是解释**代码里包含了哪些编程概念**。

当前用户知识状态：
${knowledgeSection}

AI 刚才的操作：
${operationContext}

最近几步上下文：
${stepsSection}

请分析代码内容，找出其中的编程概念并解释。严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "title": "简短标题（描述这步的核心编程概念，而非工具操作）",
  "explanation": "用生活化的语言解释代码中的编程概念。比如看到 import 就解释模块导入，看到 async/await 就解释异步编程，看到 if/else 就解释条件判断。未接触的概念要详细解释并用类比，已掌握的概念一笔带过",
  "concepts": [{"name": "概念英文名", "label": "概念中文名", "level": 1}],
  "reasoning": "为什么 AI 在这一步选择了这样的代码写法"
}

概念示例（不限于此）：variable, function, import, export, async_await, promise, array, object, loop, condition, type_annotation, interface, class, error_handling, callback, template_literal, destructuring, spread_operator, arrow_function, api_call, npm_package, file_io, http_request, json, regex, event_listener

规则：
1. 重点分析代码内容中的编程概念，不要只说"AI 创建了一个文件"
2. 已掌握的概念一笔带过，聚焦用户还不会的概念
3. 未接触的概念用生活化类比详细解释（比如"import 就像从图书馆借一本工具书来用"）
4. 如果代码包含多个概念，挑最重要的 2-3 个重点讲
5. explanation 控制在 200 字以内
6. 用中文`;
}

export async function generateTeaching(
  client: Anthropic,
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
  model: string = "claude-sonnet-4-6",
): Promise<TeachingContent> {
  const prompt = buildPrompt(event, knowledge, recentSteps);

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      type: "teaching",
      title: String(parsed.title ?? ""),
      explanation: String(parsed.explanation ?? ""),
      concepts: Array.isArray(parsed.concepts)
        ? (parsed.concepts as Array<{ name: string; label: string; level: 0 | 1 | 2 | 3 }>)
        : [],
      reasoning: String(parsed.reasoning ?? ""),
    };
  } catch {
    return {
      type: "teaching",
      title: `${event.tool_name} 操作`,
      explanation: text.slice(0, 300),
      concepts: [],
      reasoning: "",
    };
  }
}
