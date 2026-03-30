# Learn While Building v0.3 — 完善体验设计

## 概述

在 v0.1（实时教学）和 v0.2（交互练习）的基础上，完善用户体验：自动分屏支持、学习进度可视化、教学深度控制、安全重置、教学内容存档与离线复习。

## 1. Ghostty AppleScript 自动分屏

### 实现

修改 `src/terminal/ghostty.ts`，macOS 下用 `osascript` 调用 Ghostty 的 AppleScript API：

```bash
osascript -e '
tell application "Ghostty"
  set cfg to new surface configuration with properties {command: "lwb watch"}
  set t to focused terminal of selected tab of front window
  split t direction right with configuration cfg
end tell
'
```

### 终端检测优先级更新

```
1. tmux      → tmux split-window -h "lwb watch"（自动）
2. Ghostty   → AppleScript split（macOS 自动）
3. Warp/其他 → 手动提示 Cmd+D + lwb watch
```

修改 `src/server/index.ts` 和 `src/skill/learn.md` 中 `/learn start` 的分屏逻辑。

## 2. `/learn depth <1-3>` 教学深度控制

### Config 扩展

`~/.learn-while-building/config.json` 新增 `depth` 字段：

```json
{
  "model": "claude-sonnet-4-6",
  "depth": 2
}
```

`LwbConfig` 类型更新：

```ts
type LwbConfig = {
  readonly model: string;
  readonly depth: 1 | 2 | 3;
};
```

### 深度级别

| 级别 | 名称 | prompt 指令 |
|------|------|------------|
| 1 | 简略 | "每个概念用一句话概括，总共不超过 80 字" |
| 2 | 适中 | "未接触的概念详细解释，已掌握的一笔带过，控制在 200 字以内"（当前默认） |
| 3 | 详细 | "每个概念都详细展开，多用生活化类比和代码示例，可以写到 400 字" |

### 接口

- `POST /config` 接受 `{ "depth": 1|2|3 }`（复用现有端点）
- Skill: `/learn depth 1` → `curl -s -X POST .../config -d '{"depth": 1}'`

## 3. `/learn reset` 安全重置

### 流程

1. Skill 执行 `/learn reset` → `POST /reset`
2. 服务端广播 `{ type: "confirm_reset" }` 到 watch 客户端
3. watch 客户端显示确认提示：
   ```
   ⚠️  这将清除所有已记录的学习进度，无法恢复。
       确定要重置吗？(y/N): _
   ```
4. 用户输入：
   - `y` → WebSocket 发送 `{ type: "confirm_reset", confirmed: true }` → 服务端清空 knowledge.json → 广播 `{ type: "status", message: "学习进度已重置" }`
   - 其他任意输入 → 回到教学模式，不做任何操作

### 类型扩展

```ts
// WatchMessage 新增
| { readonly type: "confirm_reset" }

// ClientMessage 新增
| { readonly type: "confirm_reset"; readonly confirmed: boolean }
```

## 4. `/learn status` 知识图谱可视化

### 流程

1. Skill 执行 `/learn status` → `POST /status`
2. 服务端广播 `{ type: "knowledge_status", data: KnowledgeStore }` 到 watch 客户端
3. watch 客户端临时切换到状态视图

### 显示格式

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 学习进度
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 已掌握 (3): variable, function, loop
🔵 理解 (2):   async_await, promise
🟡 见过 (4):   import, export, type, interface
🔴 薄弱 (1):   decorator

总计: 10 个概念 | 学习天数: 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

按任意键回到教学模式。

### 类型扩展

```ts
// WatchMessage 新增
| { readonly type: "knowledge_status"; readonly data: KnowledgeStore }
```

## 5. 教学内容本地存档 + 复习模式

### 存档

每次教学内容生成后，追加一行到 `~/.learn-while-building/archive.jsonl`：

```json
{"timestamp":"2026-03-30T12:00:00Z","project":"/Users/wh/coding/my-app","concepts":["import","variable"],"title":"导入模块和声明变量","explanation":"...","reasoning":"..."}
```

- JSONL 格式，一行一条，追加写入
- 每条记录带 `concepts`（按概念检索）、`project`（按项目过滤）、`timestamp`（按时间排序）

### 存档模块

新增 `src/teaching/archive.ts`：

```ts
type ArchiveEntry = {
  readonly timestamp: string;
  readonly project: string;
  readonly concepts: ReadonlyArray<string>;
  readonly title: string;
  readonly explanation: string;
  readonly reasoning: string;
};

appendArchive(filePath, entry): Promise<void>  // 追加一行
loadArchive(filePath): Promise<ReadonlyArray<ArchiveEntry>>  // 读取全部
filterByConcept(entries, concept): ReadonlyArray<ArchiveEntry>  // 按概念过滤
```

### 复习模式 (`lwb review`)

独立 Ink 应用，纯本地，不需要网络或 API Key：

- 读取 `~/.learn-while-building/archive.jsonl`
- 默认按时间倒序显示
- 支持输入概念名过滤
- 上下箭头翻页浏览

### CLI 入口

`bin/lwb.ts` 新增 `review` 子命令。

## 新增/修改文件汇总

### 新增文件

| 文件 | 用途 |
|------|------|
| `src/teaching/archive.ts` | 存档读写与过滤 |
| `src/watch/status-view.tsx` | 知识图谱显示组件 |
| `src/watch/review-app.tsx` | 复习模式 Ink 应用 |
| `src/watch/review-cli.tsx` | 复习模式入口 |
| `tests/archive.test.ts` | 存档模块测试 |
| `tests/ghostty.test.ts` | Ghostty 分屏测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/types.ts` | 新增 ArchiveEntry、扩展 WatchMessage 和 ClientMessage |
| `src/teaching/config.ts` | DEFAULT_CONFIG 增加 depth 字段，loadConfig/saveConfig 适配 |
| `src/teaching/generator.ts` | buildPrompt 读取 depth 调整详细度 |
| `src/terminal/ghostty.ts` | 实现 AppleScript 自动分屏 |
| `src/server/index.ts` | 新增 /reset /status 端点，processEvent 后追加存档，depth 传入 generator |
| `src/watch/app.tsx` | 新增 confirm_reset 和 knowledge_status 状态处理 |
| `src/skill/learn.md` | 新增 /learn depth、/learn reset、/learn status 命令 |
| `bin/lwb.ts` | 新增 review 子命令 |
| `tests/config.test.ts` | 增加 depth 字段测试 |
| `tests/integration.test.ts` | 增加 reset/status/depth 端点测试 |
