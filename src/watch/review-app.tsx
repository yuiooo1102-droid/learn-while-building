import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { ArchiveEntry } from "../types.js";
import { loadArchive, filterByConcept } from "../teaching/archive.js";
import { homedir } from "node:os";
import { join } from "node:path";

const ARCHIVE_PATH = join(homedir(), ".learn-while-building", "archive.jsonl");

export default function ReviewApp() {
  const [allEntries, setAllEntries] = useState<ReadonlyArray<ArchiveEntry>>([]);
  const [filtered, setFiltered] = useState<ReadonlyArray<ArchiveEntry>>([]);
  const [filterText, setFilterText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadArchive(ARCHIVE_PATH).then((entries) => {
      const reversed = [...entries].reverse();
      setAllEntries(reversed);
      setFiltered(reversed);
      setLoaded(true);
    });
  }, []);

  useInput((input, key) => {
    if (key.upArrow && currentIndex > 0) setCurrentIndex((i) => i - 1);
    if (key.downArrow && currentIndex < filtered.length - 1) setCurrentIndex((i) => i + 1);
  });

  const handleFilterSubmit = (text: string) => {
    if (text.trim() === "") { setFiltered(allEntries); }
    else { setFiltered(filterByConcept([...allEntries], text.trim())); }
    setCurrentIndex(0);
  };

  if (!loaded) return <Box paddingX={1}><Text color="yellow">Loading...</Text></Box>;
  if (allEntries.length === 0) return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>📚 Review Mode</Text>
      <Text color="gray">No learning records yet. Start with /learn start and teaching content will be archived automatically.</Text>
    </Box>
  );

  const entry = filtered[currentIndex];
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box justifyContent="space-between">
        <Text bold>📚 Review Mode</Text>
        <Text color="gray">{currentIndex + 1} / {filtered.length}</Text>
      </Box>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box marginTop={1}>
        <Text>Filter by concept: </Text>
        <TextInput value={filterText} onChange={setFilterText} onSubmit={handleFilterSubmit} placeholder="enter concept name, press Enter to filter, empty Enter to clear" />
      </Box>
      {entry ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>📖 {entry.title}</Text>
          <Text color="gray">{entry.timestamp.slice(0, 16)} | {entry.project.split("/").pop()}</Text>
          <Box marginTop={1}><Text>{entry.explanation}</Text></Box>
          {entry.reasoning && <Box marginTop={1}><Text color="gray">💡 {entry.reasoning}</Text></Box>}
          <Box marginTop={1}><Text color="gray">Concepts: {entry.concepts.join(", ")}</Text></Box>
        </Box>
      ) : (
        <Box marginTop={1}><Text color="gray">No matching records</Text></Box>
      )}
      <Box marginTop={1}><Text color="gray">↑↓ navigate | Ctrl+C exit</Text></Box>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
    </Box>
  );
}
