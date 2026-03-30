# Learn While Building — 设计文档

## 概述

面向非程序员（vibe coder）的 AI 编程实时教学系统。以 Claude Code Skill 形式运行，在用户使用 Claude Code 开发项目时，通过终端分屏实时展示教学内容，帮助用户理解 AI 正在做什么、为什么这样做。

**产品形态**: Claude Code Skill + 本地服务 + 终端客户端
**目标用户**: 零基础到有一点基础的 vibe coder，系统自适应
**开源协议**: 完全开源免费

## 系统架构

```
┌─────────────────────────────────────┐
│           用户终端 (分屏)            │
│                                     │
│  ┌──────────────┐ ┌──────────────┐  │
│  │  左 Pane      │ │  右 Pane      │  │
│  │  Claude Code  │ │  lwb watch   │  │
│  │  (正常编码)   │ │  (教学面板)  │  │
│  └──────────────┘ └──────────────┘  │
└─────────────────────────────────────┘
         │                    ▲
         │ PostToolUse Hook   │ WebSocket
         ▼                    │
┌─────────────────────────────────────┐
│       learn-while-building 服务      │
│                                     │
│  ┌───────────┐  ┌────────────────┐  │
│  │ Hook 接收  │→│ 教学内容生成器  │  │
│  │ (HTTP API) │  │ (LLM 调用)    │  │
│  └───────────┘  └────────────────┘  │
│  ┌───────────┐  ┌────────────────┐  │
│  │ 知识追踪器 │  │ 练习生成器     │  │
│  │ (本地JSON) │  │ (智能触发)    │  │
│  └───────────┘  └────────────────┘  │
└─────────────────────────────────────┘
```

### 核心流程

1. 用户运行 `/learn start` 启动教学模式 → 检测终端、分屏、启动本地服务、注册 hook
2. Claude Code 每次执行工具后，PostToolUse hook 将事件发送给本地服务
3. 本地服务分析操作内容，结合用户知识状态，生成适配深度的教学解释
4. 教学内容通过 WebSocket 推送到右侧 `lwb watch` 客户端显示
5. 当智能触发条件满足时，在右侧 pane 弹出练习题

## 终端适配层

能自动分屏的自动分，不能的提示用户手动分屏后运行 `lwb watch`。

```
检测顺序:
1. Ghostty (macOS) → AppleScript 自动分屏，右 pane 自动运行 lwb watch
2. tmux            → tmux split-window 自动分屏，右 pane 自动运行 lwb watch
3. Warp / 其他     → 提示用户手动分屏 (Cmd+D)，在新 pane 运行 lwb watch
```

| 终端 | 方案 | 用户操作 |
|------|------|----------|
| Ghostty (macOS) | AppleScript 原生分屏 | 无，自动完成 |
| tmux | `tmux split-window` | 无，自动完成 |
| Warp / 其他 | 提示手动分屏 | Cmd+D → 输入 `lwb watch` |

## 核心模块

### Hook 接收器

Claude Code 的 PostToolUse hook 通过 HTTP 发送事件到本地服务：

```
POST http://localhost:3579/event
{
  "tool_name": "Write",
  "tool_input": { "file_path": "...", "content": "..." },
  "tool_output": "...",
  "timestamp": "..."
}
```

接收器职责：
- 将事件传给教学内容生成器
- 将事件记录到会话日志（供练习生成器参考）

### 教学内容生成器

组合三个上下文生成教学内容：

1. **Hook 事件** — 刚发生了什么
2. **用户知识状态** — 用户会什么
3. **会话上下文** — 前几步做了什么

**自适应深度逻辑**：
- 概念首次出现 → 详细解释 + 生活化类比
- 概念出现过几次 → 简短提醒
- 概念已掌握 → 跳过，只在有新用法时提及

**模型选择**: Haiku 生成教学内容（速度快、成本低）。练习题评判用 Sonnet。

### 知识追踪器

长期存储 + 短期推断结合：

```json
// ~/.learn-while-building/knowledge.json
{
  "concepts": {
    "variable": { "level": 3, "encounters": 12, "last_seen": "2026-03-30" },
    "function": { "level": 2, "encounters": 5, "last_seen": "2026-03-30" },
    "api_call": { "level": 0, "encounters": 0 }
  }
}
```

- `level`: 0=未接触, 1=见过, 2=理解, 3=掌握
- 每次 LLM 生成教学内容时，同时评估并更新相关概念的掌握程度
- 对话上下文用于短期调整教学深度

### 练习生成器（"我来试试"）

**智能触发条件**（满足任一即触发）：
- 新概念首次出现且已解释完
- 连续 3 个步骤涉及同一概念但用户 level < 2
- 当前步骤涉及关键决策点

**手动触发**: `/learn try`

**练习类型**：
- **预测题**: "AI 接下来要做什么？"
- **修改题**: "试试把这个参数从 X 改成 Y，看看会发生什么"
- **选择题**: "这里用了方案 A，你觉得方案 B 会有什么问题？"

练习在右侧 pane 显示和交互，左侧 Claude Code 不受阻塞。

## Skill 接口

| 命令 | 作用 |
|------|------|
| `/learn start` | 启动教学模式（检测终端、分屏、启服务、注册 hook） |
| `/learn stop` | 停止教学模式（关闭服务、移除 hook、关闭 pane） |
| `/learn try` | 手动触发一道练习题 |
| `/learn status` | 查看知识图谱 |
| `/learn reset` | 重置知识状态（二次确认，默认否） |
| `/learn depth <1-3>` | 手动设置教学详细程度 |

### `/learn reset` 安全确认

```
> /learn reset

⚠️  这将清除所有已记录的学习进度，无法恢复。
    确定要重置吗？(y/N): _
```

默认 N，必须显式输入 y 才执行。

## 右侧 Pane 内容格式

### 教学内容

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 AI 正在: 创建 src/index.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

这一步做了什么：
  创建了项目的入口文件。入口文件就是
  程序运行时第一个被执行的文件。

涉及概念：
  • 入口文件 (entry point)  🟢 已掌握
  • TypeScript (.ts 后缀)   🟡 见过

为什么这样做：
  Claude 选择 TypeScript 而不是
  JavaScript，因为 TypeScript 能在
  写代码时就发现错误，对项目维护更友好。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 练习题

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 试试看！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI 刚刚创建了一个函数 `getUser(id)`。
如果我们想让它同时支持按名字查找，
你觉得应该怎么改？

  A) 加一个新参数 name
  B) 创建一个新函数 getUserByName
  C) 把 id 参数改成一个对象

输入你的答案 (a/b/c):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Hook 配置

`/learn start` 执行时自动写入 `.claude/settings.local.json`：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "command": "curl -s -X POST http://localhost:3579/event -H 'Content-Type: application/json' -d '{\"tool_name\":\"$TOOL_NAME\",\"tool_input\":$TOOL_INPUT,\"tool_output\":$TOOL_OUTPUT}'"
      }
    ]
  }
}
```

`/learn stop` 时自动移除。

## LLM Prompt 策略

```
你是一个编程教师，正在向一个非程序员解释 AI 编程助手的操作。

当前用户知识状态：
- 已掌握: variable, function, loop
- 见过: async, promise
- 未接触: decorator, middleware

刚才 AI 执行了以下操作：
- 工具: {tool_name}
- 参数: {tool_input}
- 结果: {tool_output}

最近 3 步上下文：
{recent_steps}

请生成教学内容，规则：
1. 已掌握的概念一笔带过
2. 见过的概念简短提醒
3. 未接触的概念详细解释，用生活化类比
4. 解释"为什么这样做"，不只是"做了什么"
5. 控制在 150 字以内
6. 用中文
```

## 性能考量

| 问题 | 方案 |
|------|------|
| Hook 不能拖慢 Claude Code | curl 异步发送，不等响应 |
| LLM 调用延迟 | watch 端先显示"正在生成..."，内容到了再刷新 |
| 高频操作 | 300ms 防抖，合并连续事件为一条教学内容 |
| API 成本 | Haiku 为主；简单操作（cd、ls）用模板，不调 LLM |

## 无 API Key 场景 → 复习模式

不启动教学模式，切换为复习模式：

```
⚠️  未检测到 Anthropic API Key，已进入复习模式。
```

复习模式功能：
- 浏览过去的教学内容记录（在线学习时存档到本地）
- 按概念分类检索
- 查看练习题历史和答错的题
- 纯本地数据，不调 LLM

## 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | Claude Code 生态主流，npm 分发方便 |
| 本地服务 | Fastify | 轻量、快速，处理 hook HTTP 请求 |
| 实时通信 | WebSocket (ws) | 服务 → lwb watch 的推送通道 |
| 终端渲染 | Ink (React for CLI) | lwb watch 的终端 UI，支持富文本 |
| LLM 调用 | Anthropic SDK | 调 Claude API 生成教学内容 |
| 知识存储 | 本地 JSON 文件 | 简单直接，无外部依赖 |

## 项目结构

```
learn-while-building/
├── src/
│   ├── server/              # 本地服务
│   │   ├── index.ts         # Fastify 启动
│   │   ├── hook-handler.ts  # 接收 PostToolUse hook 事件
│   │   └── websocket.ts     # WebSocket 推送管理
│   │
│   ├── teaching/            # 教学核心
│   │   ├── generator.ts     # LLM 教学内容生成
│   │   ├── knowledge.ts     # 知识追踪器
│   │   ├── trigger.ts       # 智能触发逻辑
│   │   └── exercise.ts      # 练习题生成与评判
│   │
│   ├── terminal/            # 终端适配
│   │   ├── detect.ts        # 检测当前终端类型
│   │   ├── ghostty.ts       # AppleScript 分屏
│   │   ├── tmux.ts          # tmux 分屏
│   │   └── manual.ts        # 手动分屏提示
│   │
│   ├── watch/               # lwb watch 客户端
│   │   ├── index.ts         # 入口
│   │   ├── app.tsx          # Ink 主组件
│   │   ├── teaching-view.tsx # 教学内容渲染
│   │   └── exercise-view.tsx # 练习题交互
│   │
│   └── skill/               # Claude Code Skill 定义
│       └── learn.md         # /learn 命令的 skill 文件
│
├── bin/
│   └── lwb.ts               # CLI 入口
│
├── package.json
├── tsconfig.json
└── README.md
```

## MVP 范围与迭代计划

### MVP (v0.1) — 核心闭环

**包含**：
- `/learn start` `/learn stop` 基本生命周期
- PostToolUse hook 接收事件
- LLM 生成教学内容（Haiku）
- `lwb watch` 终端客户端（Ink 渲染）
- 终端适配：tmux 自动分屏 + 手动分屏提示（Warp 等）
- 知识追踪器（本地 JSON，level 自动更新）
- 事件防抖与基础模板（简单操作跳过 LLM）

**不包含**：
- Ghostty AppleScript 自动分屏
- 智能练习触发 + 练习题系统
- `/learn try` `/learn status` `/learn depth` `/learn reset`
- 复习模式
- 教学内容本地存档

### v0.2 — 交互练习

- 智能触发引擎
- 练习题生成与评判（Sonnet）
- `/learn try` 手动触发
- 练习结果反馈知识追踪器

### v0.3 — 完善体验

- Ghostty AppleScript 自动分屏
- `/learn status` 知识图谱可视化
- `/learn depth` 手动调深度
- `/learn reset`（二次确认，默认否）
- 教学内容本地存档 + 复习模式
