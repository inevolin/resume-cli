import React from 'react';
import { Box, Text } from 'ink';
import type { Session } from '../parser/types.js';

interface SessionListProps {
  sessions: Session[];
  cursor: number;
  visibleRows: number;
}

function formatDate(d: Date): string {
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function summarize(session: Session): string {
  const first = session.messages.find((m) => m.role === 'user');
  const text = first?.content ?? '';
  const oneLine = text.replace(/\n/g, ' ').trim();
  return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
}

export function SessionList({ sessions, cursor, visibleRows }: SessionListProps): React.ReactElement {
  const start = Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), sessions.length - visibleRows));
  const visible = sessions.slice(start, start + visibleRows);

  return (
    <Box flexDirection="column">
      {visible.map((session, i) => {
        const idx = start + i;
        const selected = idx === cursor;
        const arrow = selected ? '▶' : ' ';
        const toolLabel = session.tool.padEnd(12);
        const dateLabel = formatDate(session.timestamp);
        const agoLabel = timeAgo(session.timestamp);
        const summary = summarize(session);

        return (
          <Box key={session.sessionId ?? String(idx)} paddingLeft={1}>
            <Text color={selected ? 'greenBright' : undefined}>{arrow}{' '}</Text>
            <Text bold={selected} color={selected ? 'blueBright' : 'gray'}>{toolLabel}</Text>
            <Text color="gray">{'  '}{dateLabel}{'  '}</Text>
            <Text color={selected ? 'yellow' : 'gray'}>{agoLabel.padEnd(8)}{'  '}</Text>
            <Text color={selected ? 'white' : 'gray'}>{summary}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
