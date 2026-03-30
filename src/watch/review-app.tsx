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

  if (!loaded) return <Box paddingX={1}><Text color="yellow">加载中...</Text></Box>;
  if (allEntries.length === 0) return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>📚 复习模式</Text>
      <Text color="gray">暂无学习记录。使用 /learn start 开始学习后，教学内容会自动存档。</Text>
    </Box>
  );

  const entry = filtered[currentIndex];
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box justifyContent="space-between">
        <Text bold>📚 复习模式</Text>
        <Text color="gray">{currentIndex + 1} / {filtered.length}</Text>
      </Box>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box marginTop={1}>
        <Text>按概念过滤: </Text>
        <TextInput value={filterText} onChange={setFilterText} onSubmit={handleFilterSubmit} placeholder="输入概念名称，回车过滤，空回车清除" />
      </Box>
      {entry ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>📖 {entry.title}</Text>
          <Text color="gray">{entry.timestamp.slice(0, 16)} | {entry.project.split("/").pop()}</Text>
          <Box marginTop={1}><Text>{entry.explanation}</Text></Box>
          {entry.reasoning && <Box marginTop={1}><Text color="gray">💡 {entry.reasoning}</Text></Box>}
          <Box marginTop={1}><Text color="gray">概念: {entry.concepts.join(", ")}</Text></Box>
        </Box>
      ) : (
        <Box marginTop={1}><Text color="gray">没有匹配的记录</Text></Box>
      )}
      <Box marginTop={1}><Text color="gray">↑↓ 翻页 | Ctrl+C 退出</Text></Box>
      <Box><Text bold color="cyan">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
    </Box>
  );
}
