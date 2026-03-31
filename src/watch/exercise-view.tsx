import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { Exercise, ExerciseFeedback } from "../types.js";

type ExerciseProps = {
  readonly exercise: Exercise;
  readonly inputValue: string;
  readonly onInputChange: (value: string) => void;
  readonly onSubmit: (value: string) => void;
};

export function ExerciseView({ exercise, inputValue, onInputChange, onSubmit }: ExerciseProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color="yellow">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box><Text bold>🎯 Try it!</Text></Box>
      <Box><Text bold color="yellow">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>

      <Box flexDirection="column" marginTop={1}>
        <Text>{exercise.question}</Text>
      </Box>

      {exercise.options && exercise.options.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {exercise.options.map((opt, i) => (
            <Text key={i}>{"  "}{String.fromCharCode(65 + i)}) {opt}</Text>
          ))}
        </Box>
      )}

      {exercise.hint && (
        <Box marginTop={1}><Text color="gray">💡 Hint: {exercise.hint}</Text></Box>
      )}

      <Box marginTop={1}>
        <Text>Your answer (type skip to skip): </Text>
        <TextInput value={inputValue} onChange={onInputChange} onSubmit={onSubmit} />
      </Box>

      <Box marginTop={1}><Text bold color="yellow">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
    </Box>
  );
}

type FeedbackProps = {
  readonly feedback: ExerciseFeedback;
};

export function FeedbackView({ feedback }: FeedbackProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box><Text bold color={feedback.correct ? "green" : "red"}>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
      <Box><Text bold>{feedback.correct ? "✅ Correct!" : "❌ Not quite"}</Text></Box>
      <Box><Text bold color={feedback.correct ? "green" : "red"}>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>

      <Box flexDirection="column" marginTop={1}>
        <Text>{feedback.explanation}</Text>
      </Box>

      <Box marginTop={1}><Text bold color={feedback.correct ? "green" : "red"}>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text></Box>
    </Box>
  );
}
