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

  const inputStr = JSON.stringify(event.tool_input, null, 2);
  const responseStr = JSON.stringify(event.tool_response, null, 2).slice(0, 500);

  return `你是一个编程教师，正在向一个非程序员解释 AI 编程助手的操作。

当前用户知识状态：
${knowledgeSection}

刚才 AI 执行了以下操作：
- 工具: ${event.tool_name}
- 参数: ${inputStr}
- 结果: ${responseStr}

最近几步上下文：
${stepsSection}

请生成教学内容，严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "title": "简短标题（描述这步做了什么）",
  "explanation": "用生活化的语言解释这步操作，未接触的概念要详细解释并用类比，已掌握的概念一笔带过",
  "concepts": [{"name": "概念英文名", "label": "概念中文名", "level": 1}],
  "reasoning": "为什么 AI 选择这样做"
}

规则：
1. 已掌握的概念一笔带过
2. 见过的概念简短提醒
3. 未接触的概念详细解释，用生活化类比
4. 解释"为什么这样做"，不只是"做了什么"
5. explanation 控制在 150 字以内
6. 用中文`;
}

export async function generateTeaching(
  client: Anthropic,
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
): Promise<TeachingContent> {
  const prompt = buildPrompt(event, knowledge, recentSteps);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
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
