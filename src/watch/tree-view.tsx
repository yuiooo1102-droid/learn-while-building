import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { SkillTreeNode, ConceptLevel } from "../types.js";

const LEVEL_COLORS: Record<ConceptLevel, string> = { 0: "gray", 1: "yellow", 2: "blue", 3: "green" };
const LEVEL_ICONS: Record<ConceptLevel, string> = { 0: "○", 1: "◔", 2: "◑", 3: "●" };

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

type Props = {
  readonly tree: ReadonlyArray<SkillTreeNode>;
  readonly onDismiss: () => void;
  readonly onSelectConcept?: (conceptName: string) => void;
};

export default function TreeView({ tree, onDismiss, onSelectConcept }: Props) {
  const [expandedDomain, setExpandedDomain] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<number>(-1);

  useInput((input, key) => {
    if (key.escape || input === "q") { onDismiss(); return; }
    const domain = tree[expandedDomain];
    if (!domain) return;

    if (key.upArrow) {
      if (selectedCategory <= 0) {
        setSelectedCategory(-1);
        setExpandedDomain(prev => Math.max(0, prev - 1));
      } else {
        setSelectedCategory(prev => prev - 1);
      }
    }
    if (key.downArrow) {
      if (selectedCategory === -1) {
        if (domain.children.length > 0) setSelectedCategory(0);
        else setExpandedDomain(prev => Math.min(tree.length - 1, prev + 1));
      } else if (selectedCategory < domain.children.length - 1) {
        setSelectedCategory(prev => prev + 1);
      } else {
        setSelectedCategory(-1);
        setExpandedDomain(prev => Math.min(tree.length - 1, prev + 1));
      }
    }
    if (key.return && selectedCategory >= 0 && onSelectConcept) {
      const category = domain.children[selectedCategory];
      if (category?.concepts && category.concepts.length > 0) {
        onSelectConcept(category.concepts[0].name);
      }
    }
  });

  if (tree.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>🌳 Skill Tree</Text>
        <Text color="gray">No concepts mapped yet. Keep learning!</Text>
        <Text color="gray">Press q to return</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box><Text bold>🌳 Skill Tree</Text></Box>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>

      {tree.map((domain, di) => (
        <Box key={domain.name} flexDirection="column" marginTop={di === 0 ? 1 : 0}>
          <Box>
            <Text bold color={di === expandedDomain ? "cyan" : "white"}>
              {di === expandedDomain ? "▸ " : "  "}{domain.name}{" "}
            </Text>
            <ProgressBar progress={domain.progress} width={16} />
          </Box>

          {di === expandedDomain && domain.children.map((category, ci) => (
            <Box key={category.name} flexDirection="column" paddingLeft={2}>
              <Box>
                <Text color={ci === selectedCategory ? "cyan" : "gray"}>
                  {ci === selectedCategory ? "▸ " : "  "}├─ {category.name}{" "}
                </Text>
                <ProgressBar progress={category.progress} width={10} />
              </Box>
              {ci === selectedCategory && category.concepts && (
                <Box paddingLeft={4} flexDirection="column">
                  {category.concepts.map(c => (
                    <Text key={c.name} color={LEVEL_COLORS[c.level]}>
                      {"  "}{LEVEL_ICONS[c.level]} {c.name} ({c.encounters}x)
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color="gray">↑↓ navigate | Enter drill-down | q return</Text>
      </Box>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
    </Box>
  );
}
