---
name: try
description: Trigger an exercise question
user-invocable: true
---

# /learn:try

Manually trigger an exercise question:
```bash
curl -s -X POST http://127.0.0.1:3579/exercise/trigger
```
Then tell the user: An exercise has been generated in the dashboard — check your browser to answer it.
