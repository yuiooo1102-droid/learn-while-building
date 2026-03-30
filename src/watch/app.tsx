// src/watch/app.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text } from "ink";
import type { WatchMessage, TeachingContent, Exercise, ExerciseFeedback } from "../types.js";
import TeachingView from "./teaching-view.js";
import { ExerciseView, FeedbackView } from "./exercise-view.js";

type AppState = "teaching" | "exercise" | "feedback";

type Props = {
  readonly port: number;
};

export default function App({ port }: Props) {
  const [connected, setConnected] = useState(false);
  const [appState, setAppState] = useState<AppState>("teaching");
  const [content, setContent] = useState<TeachingContent | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  const [status, setStatus] = useState<string>("正在连接...");
  const [loading, setLoading] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setStatus("已连接，等待 Claude Code 操作...");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WatchMessage;

        if (msg.type === "teaching") {
          setContent(msg);
          setLoading(null);
          if (appState === "feedback") {
            setAppState("teaching");
          }
        } else if (msg.type === "exercise") {
          setExercise(msg);
          setInputValue("");
          setAppState("exercise");
          setLoading(null);
        } else if (msg.type === "feedback") {
          setFeedback(msg);
          setAppState("feedback");
        } else if (msg.type === "loading") {
          setLoading(msg.title);
        } else if (msg.type === "status") {
          setStatus(msg.message);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      setConnected(false);
      setStatus("连接失败，请确认教学服务已启动 (lwb serve)");
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      setStatus("连接已断开");
    };

    return () => ws.close();
  }, [port]);

  const handleSubmit = useCallback(
    (answer: string) => {
      if (!wsRef.current || appState !== "exercise") return;

      if (answer.toLowerCase() === "skip") {
        setAppState("teaching");
        return;
      }

      wsRef.current.send(JSON.stringify({ type: "answer", answer }));
      setInputValue("");
      setLoading("正在评判...");
    },
    [appState],
  );

  return (
    <Box flexDirection="column">
      <Box paddingX={1} marginBottom={1}>
        <Text color={connected ? "green" : "red"}>
          {connected ? "●" : "○"}{" "}
        </Text>
        <Text bold> Learn While Building</Text>
      </Box>

      {loading && (
        <Box paddingX={1}>
          <Text color="yellow">⏳ {loading}</Text>
        </Box>
      )}

      {!loading && appState === "exercise" && exercise && (
        <ExerciseView
          exercise={exercise}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSubmit}
        />
      )}

      {!loading && appState === "feedback" && feedback && (
        <FeedbackView feedback={feedback} />
      )}

      {!loading && appState === "teaching" && content && (
        <TeachingView content={content} />
      )}

      {!loading && appState === "teaching" && !content && (
        <Box paddingX={1}>
          <Text color="gray">{status}</Text>
        </Box>
      )}
    </Box>
  );
}
