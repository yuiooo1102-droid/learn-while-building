export type HookEvent = {
    readonly session_id: string;
    readonly hook_event_name: string;
    readonly tool_name: string;
    readonly tool_input: Record<string, unknown>;
    readonly tool_response: Record<string, unknown>;
    readonly tool_use_id: string;
    readonly cwd: string;
    readonly timestamp?: string;
    readonly agent_id?: string;
    readonly agent_type?: string;
};
export type ConceptLevel = 0 | 1 | 2 | 3;
export type ConceptState = {
    readonly level: ConceptLevel;
    readonly encounters: number;
    readonly lastSeen: string;
};
export type KnowledgeStore = {
    readonly concepts: Record<string, ConceptState>;
};
export type TeachingContent = {
    readonly type: "teaching";
    readonly title: string;
    readonly explanation: string;
    readonly concepts: ReadonlyArray<{
        readonly name: string;
        readonly label: string;
        readonly level: ConceptLevel;
        readonly domain?: string;
        readonly category?: string;
    }>;
    readonly reasoning: string;
    readonly agentId?: string;
    readonly agentLabel?: string;
};
export type Exercise = {
    readonly type: "exercise";
    readonly question: string;
    readonly options?: ReadonlyArray<string>;
    readonly hint?: string;
};
export type ExerciseFeedback = {
    readonly type: "feedback";
    readonly correct: boolean;
    readonly explanation: string;
    readonly conceptUpdates: ReadonlyArray<{
        readonly name: string;
        readonly newLevel: ConceptLevel;
    }>;
};
export type LwbConfig = {
    readonly model: string;
    readonly depth: DepthLevel;
    readonly lang: string;
    readonly goal: string;
    readonly projectType: string;
};
export type ClientMessage = {
    readonly type: "answer";
    readonly answer: string;
} | {
    readonly type: "confirm_reset";
    readonly confirmed: boolean;
} | {
    readonly type: "dismiss";
};
export type WatchMessage = TeachingContent | Exercise | ExerciseFeedback | {
    readonly type: "status";
    readonly message: string;
} | {
    readonly type: "loading";
    readonly title: string;
} | {
    readonly type: "confirm_reset";
} | {
    readonly type: "knowledge_status";
    readonly data: KnowledgeStore;
} | {
    readonly type: "skill_tree";
    readonly tree: ReadonlyArray<SkillTreeNode>;
};
export type SessionStep = {
    readonly toolName: string;
    readonly summary: string;
    readonly timestamp: string;
};
export type DepthLevel = 1 | 2 | 3;
export type ArchiveEntry = {
    readonly timestamp: string;
    readonly project: string;
    readonly concepts: ReadonlyArray<string>;
    readonly title: string;
    readonly explanation: string;
    readonly reasoning: string;
};
export type ConceptMapping = {
    readonly domain: string;
    readonly category: string;
};
export type ConceptMapStore = {
    readonly concepts: Record<string, ConceptMapping>;
};
export type SkillTreeNode = {
    readonly name: string;
    readonly progress: number;
    readonly children: ReadonlyArray<SkillTreeNode>;
    readonly concepts?: ReadonlyArray<{
        readonly name: string;
        readonly level: ConceptLevel;
        readonly encounters: number;
    }>;
};
export type GoalPreset = {
    readonly id: string;
    readonly label: string;
    readonly domains: ReadonlyArray<string>;
};
