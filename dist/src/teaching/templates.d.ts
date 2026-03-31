import type { TeachingContent } from "../types.js";
export declare function hasTemplate(toolName: string, toolInput: Record<string, unknown>): boolean;
export declare function getTemplate(toolName: string, toolInput: Record<string, unknown>): TeachingContent | null;
