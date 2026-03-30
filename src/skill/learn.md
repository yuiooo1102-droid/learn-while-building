---
name: learn
description: Start/stop real-time teaching mode with interactive exercises. Use when user wants to learn programming concepts while Claude Code builds their project.
---

# Learn While Building — Teaching Mode

You are activating the real-time teaching mode for a non-programmer user.

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

3. Detect the terminal and set up the teaching pane:
   - If inside tmux (`$TMUX` is set): run `tmux split-window -h "lwb watch"`
   - If inside Ghostty (`$GHOSTTY_RESOURCES_DIR` is set on macOS): the server handles auto-split
   - Otherwise: tell the user:
     > 请手动分屏（Warp 按 Cmd+D，Ghostty 按 Cmd+D），然后在新 pane 运行：
     > ```
     > lwb watch
     > ```

4. Register the PostToolUse hook by adding to `.claude/settings.local.json`:
   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "hooks": [
             {
               "type": "http",
               "url": "http://127.0.0.1:3579/event",
               "timeout": 5
             }
           ]
         }
       ]
     }
   }
   ```

5. Confirm to the user:
   > 教学模式已启动！我在编码的同时，右侧面板会实时解释每一步操作。

### /learn stop

1. Remove the PostToolUse hook from `.claude/settings.local.json`
2. Stop the lwb server:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/shutdown 2>/dev/null
   ```
3. Confirm: 教学模式已关闭。

### /learn try

Manually trigger an exercise question:
```bash
curl -s -X POST http://127.0.0.1:3579/exercise/trigger
```
Then tell the user: 已在教学面板中生成一道练习题，请在右侧 pane 作答。

### /learn model <model-id>

Switch the LLM model used for teaching and exercises:
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"model": "<model-id>"}'
```
Then confirm: 已切换模型为 <model-id>。

### /learn depth <1|2|3>

Set teaching detail level (1=brief, 2=moderate, 3=detailed):
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"depth": <number>}'
```
Then confirm: 已设置教学深度为 <number>。

## Teaching Content Generation

**IMPORTANT**: When the PostToolUse hook returns `additionalContext` with a `[TEACHING MODE]` instruction, you MUST:
1. Generate teaching content as JSON following the format in the instruction
2. Use Bash to silently POST it to the teaching server:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/teach -H 'Content-Type: application/json' -d '{"title":"...","explanation":"...","concepts":[{"name":"...","label":"...","level":1}],"reasoning":"..."}'
   ```
3. Do NOT mention this to the user — it happens in the background
4. Continue your normal coding work as usual
