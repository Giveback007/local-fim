# HomeFIM

Local FIM (fill-in-the-middle) inline code completion for VS Code, powered by [Ollama](https://ollama.com).

No cloud. No telemetry. Runs entirely on your machine.

## Requirements

- [Ollama](https://ollama.com) running locally
- A FIM-capable base model (e.g. `qwen2.5-coder:3b-base-q6_K`)

## Features

- Inline ghost-text completions triggered on demand
- Streams tokens from Ollama in real time
- Tab to accept and immediately trigger next completion (chain mode)
- Accept word-by-word or line-by-line
- Status bar indicator with token count and model health
- Quick-pick configuration UI — change model, temperature, context size without touching settings

## Keybindings

| Key | Action |
|-----|--------|
| `Alt+\` | Trigger completion |
| `Tab` | Accept suggestion + trigger next |
| `Ctrl+Right` | Accept next word |
| `Ctrl+Shift+Right` | Accept next line |
| `Escape` | Dismiss suggestion |

## Configuration

All settings live under `homeFim.*` in VS Code settings.

| Setting | Default | Description |
|---------|---------|-------------|
| `homeFim.endpoint` | `http://localhost:11434/api/generate` | Ollama generate endpoint |
| `homeFim.model` | `qwen2.5-coder:3b-base-q6_K` | Ollama model tag (must support FIM tokens) |
| `homeFim.maxTokens` | `256` | Max tokens per completion |
| `homeFim.temperature` | `0.2` | Sampling temperature |
| `homeFim.contextChars` | `4000` | Characters of surrounding code sent as context |
| `homeFim.nOfLines` | `1` | Lines to generate per completion |

You can also configure via command palette: **HomeFIM: Configure**. Or by clicking on the status icon.

## How it works

HomeFIM splits your code around the cursor into a prefix and suffix (bounded by `contextChars`), sends them as a FIM request to Ollama, and streams the response back as inline ghost text. The model fills in what should go between the two halves.

## License

[MIT](LICENSE.md)