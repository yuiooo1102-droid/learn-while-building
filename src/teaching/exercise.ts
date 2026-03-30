import type Anthropic from "@anthropic-ai/sdk";
import type { HookEvent, KnowledgeStore, SessionStep, Exercise, ExerciseFeedback, ConceptLevel } from "../types.js";

const LEVEL_LABELS: Record<number, string> = { 0: "未接触", 1: "见过", 2: "理解", 3: "已掌握" };

export function buildExercisePrompt(event: HookEvent, knowledge: KnowledgeStore, recentSteps: ReadonlyArray<SessionStep>): string {
  const conceptEntries = Object.entries(knowledge.concepts);
  const knowledgeSection = conceptEntries.length > 0
    ? conceptEntries.map(([name, state]) => `- ${name}: ${LEVEL_LABELS[state.level]} (遇到${state.encounters}次)`).join("\n")
    : "- (暂无学习记录)";
  const stepsSection = recentSteps.length > 0
    ? recentSteps.map((s) => `- [${s.toolName}] ${s.summary}`).join("\n")
    : "- (这是第一步)";
  const inputStr = JSON.stringify(event.tool_input, null, 2).slice(0, 500);

  return `你是一个编程教师，需要根据 AI 编程助手刚才的操作，出一道练习题来帮助非程序员学习。

当前用户知识状态：
${knowledgeSection}

刚才 AI 执行了以下操作：
- 工具: ${event.tool_name}
- 参数: ${inputStr}

最近几步上下文：
${stepsSection}

请根据用户的知识水平自行决定题目类型和难度。可以出选择题、预测题、修改题等。

严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "question": "题目内容",
  "options": ["选项A", "选项B", "选项C"],
  "hint": "可选提示"
}

规则：
1. options 字段可选，开放式问题可以不提供
2. hint 字段可选
3. 题目要与刚才的操作相关
4. 难度匹配用户当前水平
5. 用中文`;
}

export function buildJudgePrompt(exercise: Exercise, userAnswer: string, event: HookEvent): string {
  const optionsStr = exercise.options
    ? exercise.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")
    : "(开放式问题)";

  return `你是一个编程教师，正在评判非程序员学生的练习答案。

题目：${exercise.question}
选项：
${optionsStr}

学生的回答：${userAnswer}

相关操作上下文：
- 工具: ${event.tool_name}
- 参数: ${JSON.stringify(event.tool_input, null, 2).slice(0, 300)}

请评判并严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "correct": true或false,
  "explanation": "解释为什么对或错，用通俗易懂的语言",
  "conceptUpdates": [{"name": "概念英文名", "newLevel": 0到3的数字}]
}

conceptUpdates 规则：
- 回答正确且理解深入：提升相关概念 level
- 回答错误：降低或保持相关概念 level
- newLevel: 0=未接触, 1=见过, 2=理解, 3=已掌握`;
}

export async function generateExercise(client: Anthropic, event: HookEvent, knowledge: KnowledgeStore, recentSteps: ReadonlyArray<SessionStep>, model: string): Promise<Exercise> {
  const prompt = buildExercisePrompt(event, knowledge, recentSteps);
  const response = await client.messages.create({ model, max_tokens: 512, messages: [{ role: "user", content: prompt }] });
  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      type: "exercise",
      question: String(parsed.question ?? ""),
      options: Array.isArray(parsed.options) ? parsed.options.map(String) : undefined,
      hint: typeof parsed.hint === "string" ? parsed.hint : undefined,
    };
  } catch {
    return { type: "exercise", question: "刚才 AI 做了什么操作？用你自己的话描述一下。" };
  }
}

export async function judgeAnswer(client: Anthropic, exercise: Exercise, userAnswer: string, event: HookEvent, model: string): Promise<ExerciseFeedback> {
  const prompt = buildJudgePrompt(exercise, userAnswer, event);
  const response = await client.messages.create({ model, max_tokens: 512, messages: [{ role: "user", content: prompt }] });
  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      type: "feedback",
      correct: Boolean(parsed.correct),
      explanation: String(parsed.explanation ?? ""),
      conceptUpdates: Array.isArray(parsed.conceptUpdates)
        ? parsed.conceptUpdates.map((u: Record<string, unknown>) => ({ name: String(u.name ?? ""), newLevel: (Number(u.newLevel) || 0) as ConceptLevel }))
        : [],
    };
  } catch {
    return { type: "feedback", correct: false, explanation: "无法评判答案，请继续学习。", conceptUpdates: [] };
  }
}
