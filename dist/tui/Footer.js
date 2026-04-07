import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Footer({ tools, toolIndex }) {
    const tool = tools[toolIndex] ?? '';
    return (_jsx(Box, { paddingLeft: 1, paddingTop: 1, children: _jsxs(Text, { children: ['Continue in: ', _jsx(Text, { color: "blueBright", children: `◀ ${tool} ▶` }), '   ↑↓ navigate · tab: switch tool · ↵ launch · q quit'] }) }));
}
//# sourceMappingURL=Footer.js.map