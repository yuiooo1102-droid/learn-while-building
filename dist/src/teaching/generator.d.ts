import type Anthropic from "@anthropic-ai/sdk";
import type { HookEvent, KnowledgeStore, SessionStep, TeachingContent } from "../types.js";
export declare function buildPrompt(event: HookEvent, knowledge: KnowledgeStore, recentSteps: ReadonlyArray<SessionStep>, depth?: 1 | 2 | 3, lang?: string, goal?: string, projectType?: string): string;
export declare function generateTeaching(client: Anthropic, event: HookEvent, knowledge: KnowledgeStore, recentSteps: ReadonlyArray<SessionStep>, model?: string, depth?: 1 | 2 | 3, lang?: string, goal?: string, projectType?: string): Promise<TeachingContent>;
