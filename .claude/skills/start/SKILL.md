---
name: start
description: Start real-time teaching mode — learn programming while AI builds
user-invocable: true
---

# /learn:start

Start the teaching server and open the learning dashboard.

1. Check if the lwb server is already running:
   ```bash
   curl -s http://127.0.0.1:3579/health 2>/dev/null
   ```

2. If NOT running, start it:
   ```bash
   LWB_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}" node "${CLAUDE_PLUGIN_ROOT}/dist/src/server/index.js" &
   sleep 2 && curl -s http://127.0.0.1:3579/health
   ```

3. Create active marker and activate session:
   ```bash
   mkdir -p ~/.learn-while-building && touch ~/.learn-while-building/.active
   curl -s -X POST http://127.0.0.1:3579/session/activate -H 'Content-Type: application/json' -d "{\"session_id\": \"$CLAUDE_SESSION_ID\"}"
   ```

4. Open the dashboard:
   ```bash
   open http://localhost:3579 2>/dev/null || xdg-open http://localhost:3579 2>/dev/null || echo "Open http://localhost:3579 in your browser"
   ```

5. Confirm to the user:
   > Teaching mode started! The dashboard is open in your browser. As I code, explanations will appear there in real time.

## Teaching Content Generation

**IMPORTANT**: When the PostToolUse hook returns `additionalContext` with a `[TEACHING MODE]` instruction, you MUST:
1. Generate teaching content as JSON following the format in the instruction
2. Use Bash to silently POST it to the teaching server:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/teach -H 'Content-Type: application/json' -d '{"title":"...","explanation":"...","concepts":[{"name":"...","label":"...","level":1,"domain":"...","category":"..."}],"reasoning":"..."}'
   ```
3. Do NOT mention this to the user — it happens in the background
4. Continue your normal coding work as usual
