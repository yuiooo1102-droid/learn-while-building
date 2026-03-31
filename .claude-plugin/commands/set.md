---
description: Configure teaching settings (depth/lang/model/goal/path)
---

# /learn:set <key> [value]

Unified configuration command. Supported keys: `depth`, `lang`, `model`, `goal`, `path`.

**depth** (1=brief, 2=moderate, 3=detailed):
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"depth": <number>}'
```

**lang** (auto/zh/en/ja):
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"lang": "<language>"}'
```

**model** (LLM model for teaching):
```bash
curl -s -X POST http://127.0.0.1:3579/config -H 'Content-Type: application/json' -d '{"model": "<model-id>"}'
```

**goal** (learning goal — if no value given, show presets):
```bash
curl -s http://127.0.0.1:3579/goals
```
Show presets as a numbered list, plus option for custom input. Then:
```bash
curl -s -X POST http://127.0.0.1:3579/goal -H 'Content-Type: application/json' -d '{"goal": "<selected goal label or custom text>"}'
```

**path** (project type: web-frontend, web-backend, python, rust, go, node, generic):
```bash
curl -s -X POST http://127.0.0.1:3579/path -H 'Content-Type: application/json' -d '{"projectType": "<type>"}'
```

If no key is given, show all current settings:
```bash
curl -s http://127.0.0.1:3579/config
```

Then confirm what was changed.

Examples: `/learn:set depth 3`, `/learn:set lang zh`, `/learn:set goal`, `/learn:set model claude-haiku-4-5-20251001`
