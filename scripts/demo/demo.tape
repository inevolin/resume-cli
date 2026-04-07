Output assets/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 90
Set Height 28
Set Theme "Dracula"
Set TypingSpeed 60ms
Set Padding 16

# ── Scene 1: Claude hits context limit ──────────────────────────────────────

Type `PATH="scripts/demo/stubs:$PATH" claude --resume a1b2c3d4-e5f6-7890-abcd-ef1234567890`
Sleep 300ms
Enter
Sleep 3500ms

# ── Scene 2: User runs resume-cli ───────────────────────────────────────────

Type "bash scripts/demo/run.sh"
Sleep 300ms
Enter
Sleep 1500ms

# ── Scene 3: TUI — switch target to Codex, then launch ──────────────────────

Tab
Sleep 700ms
Enter
Sleep 3000ms
