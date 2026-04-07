import * as fs from 'fs';
import * as path from 'path';
import { getEntries } from './discovery.js';
export async function collectAllSessions(limit) {
    const entries = getEntries();
    const all = [];
    for (const entry of entries) {
        for (const dir of entry.paths) {
            if (!fs.existsSync(dir))
                continue;
            for (const file of walkDir(dir)) {
                if (!entry.parser.canHandle(file))
                    continue;
                try {
                    const sessions = await entry.parser.parse(file);
                    all.push(...sessions);
                }
                catch {
                    // skip unreadable files
                }
            }
        }
    }
    return all
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
}
function walkDir(dir) {
    const results = [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return results;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(full));
        }
        else if (entry.isFile()) {
            results.push(full);
        }
    }
    return results;
}
//# sourceMappingURL=sessions.js.map