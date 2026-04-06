import { Session } from './parser/types.js';
/**
 * Converts each session to a Markdown file and saves it under outputDir using:
 *   <outputDir>/<YYYY-MM>/<YYYY-MM-DD>_<tool>_<project-base>.md
 *
 * Existing files are overwritten so that re-runs are idempotent.
 */
export declare function write(sessions: Session[], outputDir: string): void;
/** Converts a human-readable name to a lowercase, hyphen-separated slug. */
export declare function slugify(s: string): string;
//# sourceMappingURL=generator.d.ts.map