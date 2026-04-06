/** A single path to watch with its associated tool name. */
export interface WatchEntry {
    path: string;
    tool: string;
}
/** Top-level configuration loaded from ~/.histd/config.toml. */
export interface Config {
    /** Directory where extracted Markdown sessions are written. */
    output_dir: string;
    /** List of source paths to monitor. */
    watch: WatchEntry[];
}
/** Returns the path to the ~/.histd directory. */
export declare function defaultConfigDir(): string;
/** Builds a Config populated with reasonable defaults. */
export declare function defaultConfig(): Config;
/** Reads the config file at filePath, creating it with defaults if absent. */
export declare function load(filePath: string): Config;
//# sourceMappingURL=config.d.ts.map