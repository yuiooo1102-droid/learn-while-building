import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

type Props = {
  readonly inputValue: string;
  readonly onInputChange: (value: string) => void;
  readonly onSubmit: (value: string) => void;
};

export default function ResetView({ inputValue, onInputChange, onSubmit }: Props) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color="red">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="red">⚠️  This will erase all learning progress permanently.</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Are you sure? (y/N): </Text>
        <TextInput value={inputValue} onChange={onInputChange} onSubmit={onSubmit} />
      </Box>
      <Box marginTop={1}><Text bold color="red">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
    </Box>
  );
}
