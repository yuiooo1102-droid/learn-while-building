---
name: stop
description: Stop teaching mode
user-invocable: true
---

# /learn:stop

1. Deactivate teaching:
   ```bash
   curl -s -X POST http://127.0.0.1:3579/session/deactivate 2>/dev/null
   ```

2. Remove active marker:
   ```bash
   rm -f ~/.learn-while-building/.active
   ```

3. Confirm: Teaching mode stopped.
