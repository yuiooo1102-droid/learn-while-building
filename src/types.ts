export type HookEvent = {
  readonly session_id: string;
  readonly hook_event_name: string;
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly tool_response: Record<string, unknown>;
  readonly tool_use_id: string;
  readonly cwd: string;
  readonly timestamp?: string;
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
  }>;
  readonly reasoning: string;
};

export type WatchMessage =
  | TeachingContent
  | { readonly type: "status"; readonly message: string }
  | { readonly type: "loading"; readonly title: string };

export type SessionStep = {
  readonly toolName: string;
  readonly summary: string;
  readonly timestamp: string;
};
