# Learn While Building

Learn programming concepts in real time while coding with Claude Code.

## Installation

```bash
npm install -g learn-while-building
```

## Usage

In Claude Code, run:

```
/learn start
```

The system will automatically:
1. Start the teaching service
2. Open the teaching panel in a terminal split (tmux auto-split; other terminals use Cmd+D manually)
3. Register the Claude Code hook

After that, every action Claude Code takes will display in real time on the right panel:
- What this step does (plain-language explanation)
- Which programming concepts are involved
- Why the AI chose this approach

To stop teaching mode:

```
/learn stop
```

## Requirements

- Node.js >= 18
- Claude Code
- Anthropic API Key (set the `ANTHROPIC_API_KEY` environment variable)

## Development

```bash
git clone <repo>
cd learn-while-building
npm install
npm run build
npm link

# Run tests
npm test
```

## License

MIT
