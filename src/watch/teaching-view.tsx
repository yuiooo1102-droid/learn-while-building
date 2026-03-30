// src/watch/teaching-view.tsx
import React from "react";
import { Box, Text } from "ink";
import type { TeachingContent, ConceptLevel } from "../types.js";

const LEVEL_ICONS: Record<ConceptLevel, string> = {
  0: "🔴",
  1: "🟡",
  2: "🔵",
  3: "🟢",
};

const LEVEL_LABELS: Record<ConceptLevel, string> = {
  0: "New",
  1: "Seen",
  2: "Understood",
  3: "Mastered",
};

type Props = {
  readonly content: TeachingContent;
};

export default function TeachingView({ content }: Props) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="cyan">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
      <Box>
        <Text bold>📖 {content.title}</Text>
      </Box>
      <Box>
        <Text bold color="cyan">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>What happened:</Text>
        <Text>  {content.explanation}</Text>
      </Box>

      {content.concepts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Concepts:</Text>
          {content.concepts.map((c) => (
            <Text key={c.name}>
              {"  "}• {c.label} ({c.name}) {LEVEL_ICONS[c.level]}{" "}
              {LEVEL_LABELS[c.level]}
            </Text>
          ))}
        </Box>
      )}

      {content.reasoning && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Why this approach:</Text>
          <Text>  {content.reasoning}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text bold color="cyan">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>
    </Box>
  );
}
