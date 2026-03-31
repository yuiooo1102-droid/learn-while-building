import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { WatchMessage, TeachingContent, Exercise, ExerciseFeedback, KnowledgeStore } from "../types.js";
import TeachingView from "./teaching-view.js";
import { ExerciseView, FeedbackView } from "./exercise-view.js";
import StatusView from "./status-view.js";
import ResetView from "./reset-view.js";

type AppState = "teaching" | "exercise" | "feedback" | "status" | "confirm_reset";
type Props = { readonly port: number };

const MAX_HISTORY = 50;

type AgentHistory = {
  readonly items: ReadonlyArray<TeachingContent>;
  readonly label: string;
};

export default function App({ port }: Props) {
  const [connected, setConnected] = useState(false);
  const [appState, setAppState] = useState<AppState>("teaching");
  // Agent-grouped history: Map<agentId, AgentHistory>
  const [agentHistories, setAgentHistories] = useState<Record<string, AgentHistory>>({});
  const [activeAgentId, setActiveAgentId] = useState<string>("main");
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = latest
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeStore | null>(null);
  const [status, setStatus] = useState<string>("Connecting...");
  const [loading, setLoading] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const agentIds = useMemo(() => Object.keys(agentHistories), [agentHistories]);
  const activeHistory = agentHistories[activeAgentId]?.items ?? [];

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); setStatus("Connected, waiting for Claude Code..."); };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WatchMessage;
        if (msg.type === "teaching") {
          const agentId = msg.agentId ?? "main";
          const agentLabel = msg.agentLabel ?? "Main";
          setAgentHistories(prev => {
            const existing = prev[agentId] ?? { items: [], label: agentLabel };
            const newItems = [...existing.items, msg];
            const trimmed = newItems.length > MAX_HISTORY ? newItems.slice(-MAX_HISTORY) : newItems;
            return { ...prev, [agentId]: { items: trimmed, label: agentLabel } };
          });
          setActiveAgentId(agentId);
          setHistoryIndex(-1);
          setLoading(null);
          if (appState === "feedback") setAppState("teaching");
        }
        else if (msg.type === "exercise") { setExercise(msg); setInputValue(""); setAppState("exercise"); setLoading(null); }
        else if (msg.type === "feedback") { setFeedback(msg); setAppState("feedback"); }
        else if (msg.type === "loading") { setLoading(msg.title); }
        else if (msg.type === "status") { setStatus(msg.message); }
        else if (msg.type === "knowledge_status") { setKnowledgeData(msg.data); setAppState("status"); }
        else if (msg.type === "confirm_reset") { setInputValue(""); setAppState("confirm_reset"); }
      } catch {}
    };
    ws.onerror = () => { setConnected(false); setStatus("Connection failed. Make sure teaching server is running (lwb serve)"); };
    ws.onclose = () => { setConnected(false); wsRef.current = null; setStatus("Disconnected"); };
    return () => ws.close();
  }, [port]);

  useInput((input, key) => {
    if (appState !== "teaching" || activeHistory.length === 0) return;

    // Up/down: browse history within current agent
    if (key.upArrow) {
      setHistoryIndex(prev => {
        const current = prev === -1 ? activeHistory.length - 1 : prev;
        return Math.max(0, current - 1);
      });
    }
    if (key.downArrow) {
      setHistoryIndex(prev => {
        if (prev === -1) return -1;
        return prev >= activeHistory.length - 1 ? -1 : prev + 1;
      });
    }

    // Left/right: switch between agents
    if (key.leftArrow && agentIds.length > 1) {
      const idx = agentIds.indexOf(activeAgentId);
      const newIdx = idx <= 0 ? agentIds.length - 1 : idx - 1;
      setActiveAgentId(agentIds[newIdx]);
      setHistoryIndex(-1);
    }
    if (key.rightArrow && agentIds.length > 1) {
      const idx = agentIds.indexOf(activeAgentId);
      const newIdx = idx >= agentIds.length - 1 ? 0 : idx + 1;
      setActiveAgentId(agentIds[newIdx]);
      setHistoryIndex(-1);
    }
  });

  const handleExerciseSubmit = useCallback((answer: string) => {
    if (!wsRef.current || appState !== "exercise") return;
    if (answer.toLowerCase() === "skip") { setAppState("teaching"); return; }
    wsRef.current.send(JSON.stringify({ type: "answer", answer }));
    setInputValue(""); setLoading("Judging answer...");
  }, [appState]);

  const handleResetSubmit = useCallback((answer: string) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "confirm_reset", confirmed: answer.toLowerCase() === "y" }));
    setAppState("teaching");
  }, []);

  const handleStatusDismiss = useCallback(() => {
    if (wsRef.current) wsRef.current.send(JSON.stringify({ type: "dismiss" }));
    setAppState("teaching");
  }, []);

  const currentContent = activeHistory.length > 0
    ? (historyIndex === -1 ? activeHistory[activeHistory.length - 1] : activeHistory[historyIndex])
    : null;

  const isViewingHistory = historyIndex !== -1 && activeHistory.length > 0;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box paddingX={1} marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={connected ? "green" : "red"}>{connected ? "●" : "○"} </Text>
          <Text bold> Learn While Building</Text>
        </Box>
        {activeHistory.length > 0 && appState === "teaching" && (
          <Text color="gray">
            {isViewingHistory
              ? `[${historyIndex + 1}/${activeHistory.length}] ↑↓ navigate`
              : `[${activeHistory.length} items] ↑ history`}
          </Text>
        )}
      </Box>

      {/* Agent tabs — only show when multiple agents exist */}
      {agentIds.length > 1 && appState === "teaching" && (
        <Box paddingX={1} marginBottom={1} gap={1}>
          <Text color="gray">←→ </Text>
          {agentIds.map(id => (
            <Text key={id} color={id === activeAgentId ? "cyan" : "gray"} bold={id === activeAgentId}>
              {id === activeAgentId ? "▸ " : "  "}{agentHistories[id].label}
            </Text>
          ))}
        </Box>
      )}

      {/* Loading overlay — show on top of previous content */}
      {loading && (
        <Box paddingX={1} marginBottom={1}>
          <Text color="yellow">{"⏳ "}{loading}</Text>
        </Box>
      )}

      {/* Main content area — always show content, even while loading */}
      {appState === "status" && knowledgeData && !loading && <StatusView data={knowledgeData} onDismiss={handleStatusDismiss} />}
      {appState === "confirm_reset" && !loading && <ResetView inputValue={inputValue} onInputChange={setInputValue} onSubmit={handleResetSubmit} />}
      {appState === "exercise" && exercise && !loading && <ExerciseView exercise={exercise} inputValue={inputValue} onInputChange={setInputValue} onSubmit={handleExerciseSubmit} />}
      {appState === "feedback" && feedback && !loading && <FeedbackView feedback={feedback} />}

      {appState === "teaching" && currentContent && (
        <Box flexDirection="column">
          {isViewingHistory && (
            <Box paddingX={1} marginBottom={1}>
              <Text color="yellow">{"📜 History — press ↓ for latest"}</Text>
            </Box>
          )}
          <TeachingView content={currentContent} />
        </Box>
      )}

      {appState === "teaching" && !currentContent && !loading && (
        <Box paddingX={1}>
          <Text color="gray">{status}</Text>
        </Box>
      )}
    </Box>
  );
}
