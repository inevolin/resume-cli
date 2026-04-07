import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { SessionList } from './SessionList.js';
import { Footer } from './Footer.js';
export function App({ sessions, installedTools, onLaunch }) {
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
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", children: "No sessions found." }), _jsx(Footer, { tools: installedTools, toolIndex: toolIndex })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { paddingLeft: 1, marginBottom: 1, children: [_jsx(Text, { bold: true, color: "blueBright", children: "histd" }), _jsx(Text, { color: "gray", children: "  \u2014 recent AI coding sessions" })] }), _jsx(SessionList, { sessions: sessions, cursor: cursor, visibleRows: 20 }), _jsx(Footer, { tools: installedTools, toolIndex: toolIndex })] }));
}
//# sourceMappingURL=App.js.map