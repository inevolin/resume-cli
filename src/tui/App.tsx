import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Session } from '../parser/types.js';
import { SessionList } from './SessionList.js';
import { Footer } from './Footer.js';

interface AppProps {
  sessions: Session[];
  installedTools: string[];
  onLaunch: (session: Session, tool: string) => void;
}

export function App({ sessions, installedTools, onLaunch }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  const [toolIndex, setToolIndex] = useState(0);

  useInput(useCallback((input, key) => {
    if (input === 'q' || key.escape) {
      exit();
      return;
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(sessions.length - 1, c + 1));
      return;
    }
    if (key.tab) {
      setToolIndex((t) => (t + 1) % Math.max(1, installedTools.length));
      return;
    }
    if (key.return && sessions.length > 0) {
      const session = sessions[cursor];
      const tool = installedTools[toolIndex] ?? installedTools[0];
      exit();
      onLaunch(session, tool);
    }
  }, [cursor, sessions, installedTools, toolIndex, exit, onLaunch]));

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="gray">No sessions found.</Text>
        <Footer tools={installedTools} toolIndex={toolIndex} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box paddingLeft={1} marginBottom={1}>
        <Text bold color="blueBright">histd</Text>
        <Text color="gray">  — recent AI coding sessions</Text>
      </Box>
      <SessionList sessions={sessions} cursor={cursor} visibleRows={20} />
      <Footer tools={installedTools} toolIndex={toolIndex} />
    </Box>
  );
}
