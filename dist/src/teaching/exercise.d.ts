import type Anthropic from "@anthropic-ai/sdk";
import type { HookEvent, KnowledgeStore, SessionStep, Exercise, ExerciseFeedback } from "../types.js";
export declare function buildExercisePrompt(event: HookEvent, knowledge: KnowledgeStore, recentSteps: ReadonlyArray<SessionStep>): string;
export declare function buildJudgePrompt(exercise: Exercise, userAnswer: string, event: HookEvent): string;
export declare function generateExercise(client: Anthropic, event: HookEvent, knowledge: KnowledgeStore, recentSteps: ReadonlyArray<SessionStep>, model: string): Promise<Exercise>;
export declare function judgeAnswer(client: Anthropic, exercise: Exercise, userAnswer: string, event: HookEvent, model: string): Promise<ExerciseFeedback>;
