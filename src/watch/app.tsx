// src/watch/app.tsx
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { WatchMessage, TeachingContent } from "../types.js";
import TeachingView from "./teaching-view.js";

type Props = {
  readonly port: number;
};

export default function App({ port }: Props) {
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState<TeachingContent | null>(null);
  const [status, setStatus] = useState<string>("正在连接...");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

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
      setStatus("连接已断开");
    };

    return () => ws.close();
  }, [port]);

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

      {content && !loading && <TeachingView content={content} />}

      {!content && !loading && (
        <Box paddingX={1}>
          <Text color="gray">{status}</Text>
        </Box>
      )}
    </Box>
  );
}
