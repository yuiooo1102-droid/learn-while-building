const LEVEL_LABELS = { 0: "not seen", 1: "seen", 2: "understood", 3: "mastered" };
export function buildExercisePrompt(event, knowledge, recentSteps) {
    const conceptEntries = Object.entries(knowledge.concepts);
    const knowledgeSection = conceptEntries.length > 0
        ? conceptEntries.map(([name, state]) => `- ${name}: ${LEVEL_LABELS[state.level]} (seen ${state.encounters} times)`).join("\n")
        : "- (no learning records yet)";
    const stepsSection = recentSteps.length > 0
        ? recentSteps.map((s) => `- [${s.toolName}] ${s.summary}`).join("\n")
        : "- (this is the first step)";
    const inputStr = JSON.stringify(event.tool_input, null, 2).slice(0, 500);
    return `You are a programming teacher. Based on what the AI coding assistant just did, create an exercise question to help a non-programmer learn.

Current user knowledge state:
${knowledgeSection}

The AI just performed the following action:
- Tool: ${event.tool_name}
- Input: ${inputStr}

Recent context steps:
${stepsSection}

Choose the question type and difficulty based on the user's knowledge level. You may use multiple-choice, prediction, or fill-in-the-blank questions.

Output strictly in the following JSON format (no other text):
{
  "question": "question text",
  "options": ["Option A", "Option B", "Option C"],
  "hint": "optional hint"
}

Rules:
1. options is optional — omit for open-ended questions
2. hint is optional
3. The question must relate to the action just performed
4. Match difficulty to the user's current level
5. Use English`;
}
export function buildJudgePrompt(exercise, userAnswer, event) {
    const optionsStr = exercise.options
        ? exercise.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")
        : "(open-ended question)";
    return `You are a programming teacher evaluating a non-programmer student's exercise answer.

Question: ${exercise.question}
Options:
${optionsStr}

Student's answer: ${userAnswer}

Related action context:
- Tool: ${event.tool_name}
- Input: ${JSON.stringify(event.tool_input, null, 2).slice(0, 300)}

Evaluate and output strictly in the following JSON format (no other text):
{
  "correct": true or false,
  "explanation": "explain why the answer is right or wrong in plain language",
  "conceptUpdates": [{"name": "concept-name-in-english", "newLevel": number from 0 to 3}]
}

conceptUpdates rules:
- Correct answer with deep understanding: increase the related concept level
- Wrong answer: decrease or keep the related concept level
- newLevel: 0=not seen, 1=seen, 2=understood, 3=mastered`;
}
export async function generateExercise(client, event, knowledge, recentSteps, model) {
    const prompt = buildExercisePrompt(event, knowledge, recentSteps);
    const response = await client.messages.create({ model, max_tokens: 512, messages: [{ role: "user", content: prompt }] });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
        const parsed = JSON.parse(text);
        return {
            type: "exercise",
            question: String(parsed.question ?? ""),
            options: Array.isArray(parsed.options) ? parsed.options.map(String) : undefined,
            hint: typeof parsed.hint === "string" ? parsed.hint : undefined,
        };
    }
    catch {
        return { type: "exercise", question: "What did the AI just do? Describe it in your own words." };
    }
}
export async function judgeAnswer(client, exercise, userAnswer, event, model) {
    const prompt = buildJudgePrompt(exercise, userAnswer, event);
    const response = await client.messages.create({ model, max_tokens: 512, messages: [{ role: "user", content: prompt }] });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
        const parsed = JSON.parse(text);
        return {
            type: "feedback",
            correct: Boolean(parsed.correct),
            explanation: String(parsed.explanation ?? ""),
            conceptUpdates: Array.isArray(parsed.conceptUpdates)
                ? parsed.conceptUpdates.map((u) => ({ name: String(u.name ?? ""), newLevel: (Number(u.newLevel) || 0) }))
                : [],
        };
    }
    catch {
        return { type: "feedback", correct: false, explanation: "Unable to evaluate the answer, please keep learning.", conceptUpdates: [] };
    }
}
//# sourceMappingURL=exercise.js.map