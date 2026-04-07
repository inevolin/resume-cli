import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
function formatDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}
function summarize(session) {
    const first = session.messages.find((m) => m.role === 'user');
    const text = first?.content ?? '';
    const oneLine = text.replace(/\n/g, ' ').trim();
    return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
}
export function SessionList({ sessions, cursor, visibleRows }) {
    const start = Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), sessions.length - visibleRows));
    const visible = sessions.slice(start, start + visibleRows);
    return (_jsx(Box, { flexDirection: "column", children: visible.map((session, i) => {
            const idx = start + i;
            const selected = idx === cursor;
            const arrow = selected ? '▶' : ' ';
            const toolLabel = session.tool.padEnd(12);
            const dateLabel = formatDate(session.timestamp);
            const summary = summarize(session);
            return (_jsxs(Box, { paddingLeft: 1, children: [_jsxs(Text, { color: selected ? 'greenBright' : undefined, children: [arrow, ' '] }), _jsx(Text, { bold: selected, color: selected ? 'blueBright' : 'gray', children: toolLabel }), _jsxs(Text, { color: "gray", children: ['  ', dateLabel, '  '] }), _jsx(Text, { color: selected ? 'white' : 'gray', children: summary })] }, session.sessionId ?? String(idx)));
        }) }));
}
//# sourceMappingURL=SessionList.js.map