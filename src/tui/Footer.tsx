import React from 'react';
import { Box, Text } from 'ink';

interface FooterProps {
  tools: string[];
  toolIndex: number;
}

export function Footer({ tools, toolIndex }: FooterProps): React.ReactElement {
  const tool = tools[toolIndex] ?? '';
  return (
    <Box paddingLeft={1} paddingTop={1}>
      <Text>
        {'Continue in: '}
        <Text color="blueBright">{`◀ ${tool} ▶`}</Text>
        {'   ↑↓ navigate · tab: switch tool · ↵ launch · q quit'}
      </Text>
    </Box>
  );
}
