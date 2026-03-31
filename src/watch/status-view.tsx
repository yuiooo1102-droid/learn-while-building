import React from "react";
import { Box, Text, useInput } from "ink";
import type { KnowledgeStore, ConceptLevel } from "../types.js";

const LEVEL_CONFIG: Record<ConceptLevel, { icon: string; label: string; color: string }> = {
  3: { icon: "●", label: "Mastered", color: "green" },
  2: { icon: "◑", label: "Understood", color: "blue" },
  1: { icon: "◔", label: "Seen", color: "yellow" },
  0: { icon: "○", label: "New", color: "gray" },
};

const SEP = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function ProgressBar({ progress, width = 20 }: { progress: number; width?: number }) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const color = progress >= 75 ? "green" : progress >= 40 ? "yellow" : "red";
  return (
    <Text>
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>
      <Text color="gray"> {progress}%</Text>
    </Text>
  );
}

type Props = { readonly data: KnowledgeStore; readonly onDismiss: () => void };

export default function StatusView({ data, onDismiss }: Props) {
  useInput(() => { onDismiss(); });

  const grouped: Record<ConceptLevel, string[]> = { 3: [], 2: [], 1: [], 0: [] };
  for (const [name, state] of Object.entries(data.concepts)) {
    grouped[state.level].push(name);
  }
  const total = Object.keys(data.concepts).length;
  const mastered = grouped[3].length;
  const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const days = new Set(Object.values(data.concepts).map((s) => s.lastSeen)).size;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color="cyan">{SEP}</Text></Box>
      <Box><Text bold>📊 Learning Progress</Text></Box>
      <Box><Text bold color="cyan">{SEP}</Text></Box>

      {([3, 2, 1, 0] as ConceptLevel[]).map((level, idx) => {
        const concepts = grouped[level];
        if (concepts.length === 0) return null;
        const cfg = LEVEL_CONFIG[level];
        return (
          <Box key={level} marginTop={idx === 0 ? 1 : 0}>
            <Text color={cfg.color}>{cfg.icon} {cfg.label} ({concepts.length}): {concepts.join(", ")}</Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text>Total: {total} concepts | Days learning: {days} | Mastered: </Text>
        <ProgressBar progress={masteredPct} width={16} />
      </Box>

      <Box marginTop={1}><Text color="gray">Press any key to return...</Text></Box>
      <Box><Text bold color="cyan">{SEP}</Text></Box>
    </Box>
  );
}
