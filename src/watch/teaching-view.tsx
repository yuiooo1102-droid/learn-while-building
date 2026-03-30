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
  0: "未接触",
  1: "见过",
  2: "理解",
  3: "已掌握",
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
        <Text bold>这一步做了什么：</Text>
        <Text>  {content.explanation}</Text>
      </Box>

      {content.concepts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>涉及概念：</Text>
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
          <Text bold>为什么这样做：</Text>
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
