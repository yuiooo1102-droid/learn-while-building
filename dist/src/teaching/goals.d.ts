import type { GoalPreset } from "../types.js";
export declare const GOAL_PRESETS: ReadonlyArray<GoalPreset>;
export declare function detectProjectType(files: ReadonlyArray<string>, packageJson: Record<string, unknown> | null): string;
