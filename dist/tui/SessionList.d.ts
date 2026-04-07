import React from 'react';
import type { Session } from '../parser/types.js';
interface SessionListProps {
    sessions: Session[];
    cursor: number;
    visibleRows: number;
}
export declare function SessionList({ sessions, cursor, visibleRows }: SessionListProps): React.ReactElement;
export {};
//# sourceMappingURL=SessionList.d.ts.map