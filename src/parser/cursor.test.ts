import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CursorParser } from '../parser/cursor';

describe('CursorParser.canHandle', () => {
  const p = new CursorParser();

  it('should handle state.vscdb', () => {
    expect(p.canHandle('/home/user/.config/Cursor/User/workspaceStorage/abc/state.vscdb')).toBe(true);
  });

  it('should handle .json files in Cursor path', () => {
    expect(p.canHandle('/home/user/.config/Cursor/chat.json')).toBe(true);
  });

  it('should not handle claude jsonl files', () => {
    expect(p.canHandle('/home/user/.claude/projects/abc/session.jsonl')).toBe(false);
  });
});

describe('CursorParser.parse (JSON)', () => {
  it('should parse a tab-array JSON file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-test-'));
    const tabs = [
      {
        tabId: 'tab-1',
        chatTitle: 'Test chat',
        lastSendTime: 1744000000000,
        bubbles: [
          { type: 'user', text: 'What is TypeScript?' },
          { type: 'ai', text: 'TypeScript is a typed superset of JavaScript.' },
        ],
      },
    ];
    const cursorDir = path.join(dir, 'Cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    const filePath = path.join(cursorDir, 'chat.json');
    fs.writeFileSync(filePath, JSON.stringify(tabs));

    const p = new CursorParser();
    const sessions = await p.parse(filePath);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].tool).toBe('Cursor');
    expect(sessions[0].messages).toHaveLength(2);
    expect(sessions[0].messages[1].role).toBe('assistant');

    fs.rmSync(dir, { recursive: true });
  });
});
