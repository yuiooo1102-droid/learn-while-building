import type Anthropic from "@anthropic-ai/sdk";
import type {
  HookEvent,
  KnowledgeStore,
  SessionStep,
  TeachingContent,
} from "../types.js";

const LEVEL_LABELS: Record<number, string> = {
  0: "not seen",
  1: "seen",
  2: "understood",
  3: "mastered",
};

export function buildPrompt(
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
  depth: 1 | 2 | 3 = 2,
  lang: string = "auto",
): string {
  // Only include relevant knowledge: weak concepts (level < 3) and recent ones
  // This saves ~500 tokens vs dumping the full 200+ concept list
  const conceptEntries = Object.entries(knowledge.concepts);
  const weakConcepts = conceptEntries
    .filter(([, state]) => state.level < 3)
    .sort((a, b) => b[1].encounters - a[1].encounters)
    .slice(0, 15);
  const masteredCount = conceptEntries.filter(([, s]) => s.level >= 3).length;

  const knowledgeSection =
    weakConcepts.length > 0
      ? [
          ...weakConcepts.map(([name, state]) => `- ${name}: ${LEVEL_LABELS[state.level]}`),
          masteredCount > 0 ? `- (${masteredCount} other concepts already mastered)` : "",
        ].filter(Boolean).join("\n")
      : "- (no learning history yet)";

  const stepsSection =
    recentSteps.length > 0
      ? recentSteps.map((s) => `- [${s.toolName}] ${s.summary}`).join("\n")
      : "- (this is the first step)";

  const toolName = event.tool_name;
  const toolInput = event.tool_input;

  // Extract the most educational content based on tool type
  let codeContent = "";
  let operationContext = "";

  if (toolName === "Write" || toolName === "MultiEdit") {
    codeContent = String(toolInput.content ?? "").slice(0, 800);
    operationContext = `Create/write file: ${String(toolInput.file_path ?? "").split("/").pop()}\n\nCode content:\n\`\`\`\n${codeContent}\n\`\`\``;
  } else if (toolName === "Edit") {
    const oldStr = String(toolInput.old_string ?? "").slice(0, 500);
    const newStr = String(toolInput.new_string ?? "").slice(0, 500);
    operationContext = `Edit file: ${String(toolInput.file_path ?? "").split("/").pop()}\n\nBefore:\n\`\`\`\n${oldStr}\n\`\`\`\n\nAfter:\n\`\`\`\n${newStr}\n\`\`\``;
  } else if (toolName === "Bash") {
    const cmd = String(toolInput.command ?? "");
    const output = JSON.stringify(event.tool_response, null, 2).slice(0, 800);
    operationContext = `Run command: ${cmd}\n\nOutput:\n${output}`;
  } else if (toolName === "Read") {
    const fileContent = JSON.stringify(event.tool_response, null, 2).slice(0, 1500);
    operationContext = `Read file: ${String(toolInput.file_path ?? "").split("/").pop()}\n\nFile content:\n${fileContent}`;
  } else {
    operationContext = `Tool: ${toolName}\nArgs: ${JSON.stringify(toolInput, null, 2).slice(0, 800)}`;
  }

  const langInstruction = lang === "auto"
    ? "Use the same language as the user's conversation (infer from context)"
    : `Use ${lang}`;

  const depthInstructions: Record<number, string> = {
    1: `Rules:
1. Summarize each concept in one sentence
2. Total explanation under 80 words
3. ${langInstruction}`,
    2: `Rules:
1. Focus on the programming concepts in the code, not just "AI created a file"
2. Briefly mention already-mastered concepts; focus on what the user hasn't learned yet
3. Explain unfamiliar concepts with everyday analogies in detail
4. If the code contains multiple concepts, highlight the 2-3 most important ones
5. Keep explanation under 200 words
6. ${langInstruction}`,
    3: `Rules:
1. Elaborate on each concept with everyday analogies and simplified code examples
2. Explain the relationships and connections between concepts
3. Briefly mention even mastered concepts to build a complete knowledge network
4. Explanation can be up to 400 words
5. ${langInstruction}`,
  };

  return `You are a programming teacher explaining in real time what an AI coding assistant is doing to a non-programmer.

Your core task is not to explain "what tool the AI used" but to explain **what programming concepts are present in the code**.

Current user knowledge state:
${knowledgeSection}

What the AI just did:
${operationContext}

Recent context steps:
${stepsSection}

Analyze the code content, identify the programming concepts, and explain them. Output strictly in the following JSON format (no other text):
{
  "title": "Short title (describing the core programming concept of this step, not the tool operation)",
  "explanation": "Explain the programming concepts in the code using everyday language. E.g. if you see import, explain module imports; async/await, explain asynchronous programming; if/else, explain conditionals. Explain unfamiliar concepts in detail with analogies; briefly mention mastered ones.",
  "concepts": [{"name": "concept-name-in-english", "label": "Display label", "level": 1}],
  "reasoning": "Why the AI chose this particular code approach in this step"
}

Concept examples (not limited to): variable, function, import, export, async_await, promise, array, object, loop, condition, type_annotation, interface, class, error_handling, callback, template_literal, destructuring, spread_operator, arrow_function, api_call, npm_package, file_io, http_request, json, regex, event_listener

${depthInstructions[depth]}`;
}

export async function generateTeaching(
  client: Anthropic,
  event: HookEvent,
  knowledge: KnowledgeStore,
  recentSteps: ReadonlyArray<SessionStep>,
  model: string = "claude-sonnet-4-6",
  depth: 1 | 2 | 3 = 2,
  lang: string = "auto",
): Promise<TeachingContent> {
  const prompt = buildPrompt(event, knowledge, recentSteps, depth, lang);

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
      title: `${event.tool_name} operation`,
      explanation: text.slice(0, 300),
      concepts: [],
      reasoning: "",
    };
  }
}
