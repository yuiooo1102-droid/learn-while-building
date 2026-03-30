import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput } from "ink";
import type { WatchMessage, TeachingContent, Exercise, ExerciseFeedback, KnowledgeStore } from "../types.js";
import TeachingView from "./teaching-view.js";
import { ExerciseView, FeedbackView } from "./exercise-view.js";
import StatusView from "./status-view.js";
import ResetView from "./reset-view.js";

type AppState = "teaching" | "exercise" | "feedback" | "status" | "confirm_reset";
type Props = { readonly port: number };

const MAX_HISTORY = 50;

export default function App({ port }: Props) {
  const [connected, setConnected] = useState(false);
  const [appState, setAppState] = useState<AppState>("teaching");
  const [history, setHistory] = useState<ReadonlyArray<TeachingContent>>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeStore | null>(null);
  const [status, setStatus] = useState<string>("Connecting...");
  const [loading, setLoading] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); setStatus("Connected, waiting for Claude Code..."); };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WatchMessage;
        if (msg.type === "teaching") {
          setHistory(prev => {
            const next = [...prev, msg];
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
          });
          setHistoryIndex(-1); // -1 means "show latest"
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

  // Arrow keys to browse history (only in teaching state, not during input)
  useInput((input, key) => {
    if (appState !== "teaching" || history.length === 0) return;

    if (key.upArrow) {
      setHistoryIndex(prev => {
        const current = prev === -1 ? history.length - 1 : prev;
        return Math.max(0, current - 1);
      });
    }
    if (key.downArrow) {
      setHistoryIndex(prev => {
        if (prev === -1) return -1;
        return prev >= history.length - 1 ? -1 : prev + 1;
      });
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

  const currentContent = history.length > 0
    ? (historyIndex === -1 ? history[history.length - 1] : history[historyIndex])
    : null;

  const isViewingHistory = historyIndex !== -1 && history.length > 0;

  return (
    <Box flexDirection="column">
      <Box paddingX={1} marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={connected ? "green" : "red"}>{connected ? "●" : "○"} </Text>
          <Text bold> Learn While Building</Text>
        </Box>
        {history.length > 1 && appState === "teaching" && (
          <Text color="gray">
            {isViewingHistory
              ? `[${historyIndex + 1}/${history.length}] ↑↓ navigate`
              : `[${history.length} items] ↑ history`}
          </Text>
        )}
      </Box>

      {loading && (
        <Box paddingX={1}>
          <Text color="yellow">⏳ {loading}</Text>
        </Box>
      )}

      {!loading && appState === "status" && knowledgeData && <StatusView data={knowledgeData} onDismiss={handleStatusDismiss} />}
      {!loading && appState === "confirm_reset" && <ResetView inputValue={inputValue} onInputChange={setInputValue} onSubmit={handleResetSubmit} />}
      {!loading && appState === "exercise" && exercise && <ExerciseView exercise={exercise} inputValue={inputValue} onInputChange={setInputValue} onSubmit={handleExerciseSubmit} />}
      {!loading && appState === "feedback" && feedback && <FeedbackView feedback={feedback} />}

      {!loading && appState === "teaching" && currentContent && (
        <Box flexDirection="column">
          {isViewingHistory && (
            <Box paddingX={1} marginBottom={1}>
              <Text color="yellow">📜 History — press ↓ for latest</Text>
            </Box>
          )}
          <TeachingView content={currentContent} />
        </Box>
      )}

      {!loading && appState === "teaching" && !currentContent && (
        <Box paddingX={1}>
          <Text color="gray">{status}</Text>
        </Box>
      )}
    </Box>
  );
}
