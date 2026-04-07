import { HistoryParser } from './parser/types.js';
export interface DiscoveryEntry {
    tool: string;
    paths: string[];
    parser: HistoryParser;
}
export declare function getEntries(): DiscoveryEntry[];
//# sourceMappingURL=discovery.d.ts.map