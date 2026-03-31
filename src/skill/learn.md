---
name: learn
description: Start/stop real-time teaching mode with interactive exercises. Use when user wants to learn programming concepts while Claude Code builds their project.
---

# Learn While Building — Teaching Mode

You are activating the real-time teaching mode for a non-programmer user.

The PostToolUse hook is already installed globally by `lwb setup`. You do NOT need to modify any settings files.

## Commands

### /learn start

1. Check if the lwb server is already running:
   ```bash
   curl -s http://127.0.0.1:3579/health 2>/dev/null
   ```

2. If NOT running, start the server in the background:
   ```bash
   lwb serve &
   ```

3. Activate this session so only its events show in the teaching panel:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/session/activate -H 'Content-Type: application/json' -d "{\"session_id\": \"$CLAUDE_SESSION_ID\"}"
   ```
   Note: If `$CLAUDE_SESSION_ID` is not available, use any unique identifier for this session.

4. Detect the terminal and set up the teaching pane:
   - If inside tmux (`$TMUX` is set): run `tmux split-window -h "lwb watch"`
   - If inside Ghostty (`$GHOSTTY_RESOURCES_DIR` is set on macOS): the server handles auto-split
   - Otherwise: tell the user:
     > Please split your terminal (Warp: Cmd+D, Ghostty: Cmd+D), then run in the new pane:
     > ```
     > lwb watch
     > ```

5. Confirm to the user:
   > Teaching mode started! As I code, the right panel will explain each step in real time.

### /learn stop

1. Tell the server to deactivate teaching:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/session/deactivate 2>/dev/null
   ```
2. Confirm: Teaching mode stopped. (The hook stays installed but does nothing when the server is inactive.)

### /learn try

Manually trigger an exercise question:
```bash
curl -s -X POST http://127.0.0.1:3579/exercise/trigger
```
Then tell the user: An exercise has been generated in the teaching panel — answer it in the right pane.

### /learn model <model-id>

Switch the LLM model used for teaching and exercises:
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"model": "<model-id>"}'
```
Then confirm: Model switched to <model-id>.

### /learn depth <1|2|3>

Set teaching detail level (1=brief, 2=moderate, 3=detailed):
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"depth": <number>}'
```
Then confirm: Teaching depth set to <number>.

### /learn lang <language>

Set teaching language (default: auto, which follows user's conversation language):
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"lang": "<language>"}'
```
Examples: `/learn lang zh`, `/learn lang en`, `/learn lang auto`
Then confirm the language has been set.

### /learn status

Show knowledge progress in the teaching pane:
```bash
curl -s -X POST http://127.0.0.1:3579/status
```
Then tell the user: Learning progress is now displayed in the right panel.

### /learn reset

Reset all learning progress (requires confirmation in teaching pane):
```bash
curl -s -X POST http://127.0.0.1:3579/reset
```
Then tell the user: Please confirm the reset in the right panel.

## Teaching Content Generation

**IMPORTANT**: When the PostToolUse hook returns `additionalContext` with a `[TEACHING MODE]` instruction, you MUST:
1. Generate teaching content as JSON following the format in the instruction
2. Use Bash to silently POST it to the teaching server:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/teach -H 'Content-Type: application/json' -d '{"title":"...","explanation":"...","concepts":[{"name":"...","label":"...","level":1}],"reasoning":"..."}'
   ```
3. Do NOT mention this to the user — it happens in the background
4. Continue your normal coding work as usual
