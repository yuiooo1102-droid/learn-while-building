# Learn While Building

在使用 Claude Code 编程的同时，实时学习编程概念。

## 安装

```bash
npm install -g learn-while-building
```

## 使用方法

在 Claude Code 中输入：

```
/learn start
```

系统会自动：
1. 启动教学服务
2. 在终端分屏中打开教学面板（tmux 自动分屏，其他终端需手动 Cmd+D）
3. 注册 Claude Code hook

之后 Claude Code 每执行一步操作，右侧面板都会实时显示：
- 这一步做了什么（通俗解释）
- 涉及哪些编程概念
- 为什么 AI 选择这样做

停止教学模式：

```
/learn stop
```

## 环境要求

- Node.js >= 18
- Claude Code
- Anthropic API Key（设置 `ANTHROPIC_API_KEY` 环境变量）

## 开发

```bash
git clone <repo>
cd learn-while-building
npm install
npm run build
npm link

# 运行测试
npm test
```

## License

MIT
