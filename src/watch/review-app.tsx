import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { ArchiveEntry, SkillTreeNode } from "../types.js";
import { loadArchive, filterByConcept } from "../teaching/archive.js";
import { loadConceptMap } from "../teaching/concept-map.js";
import { loadKnowledge } from "../teaching/knowledge.js";
import { buildSkillTree } from "../teaching/skill-tree.js";
import TreeView from "./tree-view.js";
import { homedir } from "node:os";
import { join } from "node:path";

const LWB_DIR = join(homedir(), ".learn-while-building");
const SEP = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

type ReviewState = "tree" | "detail";

export default function ReviewApp() {
  const [tree, setTree] = useState<ReadonlyArray<SkillTreeNode>>([]);
  const [archive, setArchive] = useState<ReadonlyArray<ArchiveEntry>>([]);
  const [state, setState] = useState<ReviewState>("tree");
  const [selectedConcept, setSelectedConcept] = useState<string>("");
  const [detailIndex, setDetailIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      loadConceptMap(join(LWB_DIR, "concept-map.json")),
      loadKnowledge(join(LWB_DIR, "knowledge.json")),
      loadArchive(join(LWB_DIR, "archive.jsonl")),
    ]).then(([conceptMap, knowledge, entries]) => {
      setTree(buildSkillTree(conceptMap, knowledge));
      setArchive(entries);
      setLoaded(true);
    });
  }, []);

  useInput((input, key) => {
    if (state !== "detail") return;
    const filtered = filterByConcept(archive, selectedConcept);
    if (key.upArrow && detailIndex > 0) setDetailIndex(i => i - 1);
    if (key.downArrow && detailIndex < filtered.length - 1) setDetailIndex(i => i + 1);
    if (key.escape || input === "q") { setState("tree"); setDetailIndex(0); }
  });

  const handleSelectConcept = (conceptName: string) => {
    setSelectedConcept(conceptName);
    setDetailIndex(0);
    setState("detail");
  };

  if (!loaded) return <Box paddingX={1}><Text color="yellow">Loading...</Text></Box>;

  if (state === "tree") {
    return tree.length > 0
      ? <TreeView tree={tree} onDismiss={() => process.exit(0)} onSelectConcept={handleSelectConcept} />
      : (
        <Box flexDirection="column" paddingX={1}>
          <Box><Text bold color="cyan">{SEP}</Text></Box>
          <Box><Text bold>📚 Review Mode</Text></Box>
          <Box><Text bold color="cyan">{SEP}</Text></Box>
          <Box marginTop={1}><Text color="gray">No learning records yet. Start with /learn start.</Text></Box>
          <Box marginTop={1}><Text bold color="cyan">{SEP}</Text></Box>
        </Box>
      );
  }

  const filtered = filterByConcept(archive, selectedConcept);
  const entry = filtered[detailIndex];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color="cyan">{SEP}</Text></Box>
      <Box justifyContent="space-between">
        <Text bold>📖 {selectedConcept}</Text>
        <Text color="gray">{filtered.length > 0 ? `${detailIndex + 1} / ${filtered.length}` : "0 / 0"}</Text>
      </Box>
      <Box><Text bold color="cyan">{SEP}</Text></Box>

      {entry ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{entry.title}</Text>
          <Text color="gray">{entry.timestamp.slice(0, 16)} | {entry.project.split("/").pop()}</Text>
          <Box marginTop={1}><Text>{entry.explanation}</Text></Box>
          {entry.reasoning && <Box marginTop={1}><Text color="gray">💡 {entry.reasoning}</Text></Box>}
        </Box>
      ) : (
        <Box marginTop={1}><Text color="gray">No records for this concept</Text></Box>
      )}

      <Box marginTop={1}><Text color="gray">↑↓ navigate | q back to tree</Text></Box>
      <Box><Text bold color="cyan">{SEP}</Text></Box>
    </Box>
  );
}
