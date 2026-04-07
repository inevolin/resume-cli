import type { Session } from './parser/types.js';
export declare function writeSyntheticClaude(session: Session, targetDir: string): string;
export declare function writeSyntheticCodex(session: Session, targetDir: string): {
    uuid: string;
    filePath: string;
};
export declare function writeSyntheticCopilot(session: Session, targetDir: string): string;
export declare function launch(session: Session, targetTool: string): void;
//# sourceMappingURL=launcher.d.ts.map