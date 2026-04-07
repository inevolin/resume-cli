import React from 'react';
import type { Session } from '../parser/types.js';
interface AppProps {
    sessions: Session[];
    installedTools: string[];
    onLaunch: (session: Session, tool: string) => void;
}
export declare function App({ sessions, installedTools, onLaunch }: AppProps): React.ReactElement;
export {};
//# sourceMappingURL=App.d.ts.map