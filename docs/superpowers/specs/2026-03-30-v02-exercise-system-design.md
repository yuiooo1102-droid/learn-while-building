# Learn While Building v0.2 — 交互练习系统设计

## 概述

在 v0.1 实时教学的基础上，增加交互式练习功能。用户在 Claude Code 编码过程中，根据概念掌握情况智能触发练习题，帮助用户从被动观看转为主动学习。

**基于**: v0.1 MVP（PostToolUse hook + Fastify 服务 + Ink 终端客户端 + 知识追踪器）
**核心变更**: 新增触发引擎、练习生成/评判、Watch 客户端练习交互、模型配置

## 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 练习是否阻塞 Claude Code | 完全不阻塞 | 练习出现在右侧 pane，AI 继续编码，用户随时可答可忽略 |
| 练习难度策略 | LLM 自行判断 | prompt 包含知识状态，Sonnet 根据上下文决定题目类型和难度 |
| 触发频率控制 | 概念驱动 | 只在新概念首次出现或薄弱概念反复出现时触发 |
| 反馈展示时长 | 直到下一条教学内容覆盖 | 简单，反馈自然被新内容替换 |
| `/learn try` 无上下文时 | 基于最近一步生成 | 只要有历史步骤就能出题 |
| LLM 模型 | 用户可配置，默认 Sonnet | 统一用一个模型做教学+练习，用户可通过 `/learn model` 切换 |

## 新增模块

### 1. 触发引擎 (trigger.ts)

纯函数，不调 LLM，只做决策：

```
shouldTriggerExercise(event, knowledge, session) → boolean
```

**触发条件**（满足任一即触发）：
- 新概念首次出现 — 事件涉及的概念在 knowledge 里 level === 0
- 薄弱概念反复出现 — 概念 level < 2 且 encounters >= 3

**不触发条件**：
- 所有涉及概念都已掌握（level >= 3）
- 事件走了静态模板（太简单的操作不出题）

触发器不持有状态，所有信息从 knowledge 和 session 读取，保持纯函数可测试。

### 2. 练习生成与评判 (exercise.ts)

**生成练习题：**

```
generateExercise(client, event, knowledge, recentSteps, model) → Exercise
```

调用 LLM，prompt 包含当前事件、知识状态、最近步骤。LLM 自行决定题目类型（选择题、预测题、修改题等），返回结构化 JSON：

```ts
type Exercise = {
  readonly type: "exercise";
  readonly question: string;
  readonly options?: ReadonlyArray<string>;  // 选择题有，开放题没有
  readonly hint?: string;
};
```

**评判答案：**

```
judgeAnswer(client, exercise, userAnswer, event, model) → ExerciseFeedback
```

再调一次 LLM，给出反馈：

```ts
type ExerciseFeedback = {
  readonly type: "feedback";
  readonly correct: boolean;
  readonly explanation: string;
  readonly conceptUpdates: ReadonlyArray<{
    readonly name: string;
    readonly newLevel: ConceptLevel;
  }>;
};
```

`conceptUpdates` 由 LLM 根据用户回答质量建议调整概念 level，反馈回知识追踪器。

### 3. 配置模块 (config.ts)

```ts
type LwbConfig = {
  readonly model: string;  // 默认 "claude-sonnet-4-6"
};
```

存储路径：`~/.learn-while-building/config.json`

与 knowledge.ts 同样模式——读写 JSON 文件，不可变更新。

## 数据流变更

### 服务端 processEvent 新增触发判断

```
processEvent(event)
  │
  ├─ 生成教学内容 → broadcast(teaching)
  │
  ├─ 更新 knowledge
  │
  └─ shouldTriggerExercise(event, knowledge, session)?
       │
      yes → generateExercise() → broadcast(exercise)
              │
              等待用户回答（通过 WebSocket 回传）
              │
              judgeAnswer() → broadcast(feedback)
              │
              更新 knowledge（根据 conceptUpdates）
```

### WebSocket 双向通信

v0.1 中 WebSocket 是单向的（服务 → watch）。v0.2 增加反向通信：

- 服务 → watch：`teaching` / `exercise` / `feedback` / `loading` / `status`
- watch → 服务：`{ type: "answer", answer: "用户输入的答案" }`

### WatchMessage 类型扩展

```ts
// 新增类型
type Exercise = {
  readonly type: "exercise";
  readonly question: string;
  readonly options?: ReadonlyArray<string>;
  readonly hint?: string;
};

type ExerciseFeedback = {
  readonly type: "feedback";
  readonly correct: boolean;
  readonly explanation: string;
};

// WatchMessage 扩展为
type WatchMessage =
  | TeachingContent
  | Exercise
  | ExerciseFeedback
  | { readonly type: "status"; readonly message: string }
  | { readonly type: "loading"; readonly title: string };
```

## Watch 客户端变更

### UI 状态机

```
teaching（默认）
    │ 收到 exercise
    ▼
exercise（显示题目，等待输入）
    │ 用户提交答案 / 输入 skip
    ▼
feedback（显示反馈）
    │ 收到下一条 teaching 内容
    ▼
teaching（回到默认）
```

### 新增 exercise-view.tsx

- 显示题目和选项（如果有）
- 文本输入框接收用户答案
- 输入 `skip` 跳过当前题目
- 左侧 Claude Code 不受阻塞，练习是可选的

### 练习题显示格式

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 试试看！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[题目内容]

  A) 选项一
  B) 选项二
  C) 选项三

💡 提示: [hint 内容]

输入答案 (输入 skip 跳过):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 反馈显示格式

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 回答正确！ / ❌ 不太对
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[解释内容]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 新增 HTTP 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/exercise/trigger` | POST | `/learn try` 手动触发练习 |
| `/config` | POST | 更新配置（模型等） |
| `/config` | GET | 读取当前配置 |

## Skill 接口变更

新增命令：

| 命令 | 作用 |
|------|------|
| `/learn try` | 手动触发一道练习题（POST /exercise/trigger） |
| `/learn model <model-id>` | 切换 LLM 模型（POST /config） |

## 现有模块变更

| 文件 | 变更 |
|------|------|
| `src/types.ts` | 新增 Exercise、ExerciseFeedback、LwbConfig 类型 |
| `src/server/index.ts` | processEvent 增加触发判断；新增 /exercise/trigger、/config 端点；WebSocket 处理用户答案 |
| `src/teaching/generator.ts` | 模型改为从 config 读取，默认 claude-sonnet-4-6 |
| `src/watch/app.tsx` | 增加 exercise/feedback 状态管理；WebSocket 双向通信 |
| `src/skill/learn.md` | 新增 `/learn try` 和 `/learn model` 指令 |

## 新增文件

| 文件 | 用途 |
|------|------|
| `src/teaching/trigger.ts` | 智能触发引擎 |
| `src/teaching/exercise.ts` | 练习题生成与评判 |
| `src/teaching/config.ts` | 配置读写 |
| `src/watch/exercise-view.tsx` | 练习题 Ink 组件 |
| `tests/trigger.test.ts` | 触发引擎测试 |
| `tests/exercise.test.ts` | 练习生成/评判测试 |
| `tests/config.test.ts` | 配置模块测试 |
