# obsidian-opencode-sidebar

Run [OpenCode](https://opencode.ai) in your Obsidian sidebar.

Full TypeScript source included — audit every line.

## Features

- Embedded terminal powered by xterm.js
- Auto-starts OpenCode when you open the panel
- Right-click any folder → "Open OpenCode here"
- Right-click selected text → "Send to OpenCode"
- YOLO mode (skip permissions prompts)
- Obsidian theme-aware ANSI colors
- CJK / IME input support
- Cross-platform: macOS, Linux, Windows

## Requirements

| Platform | Requirement |
|----------|------------|
| All | Python 3, [opencode](https://opencode.ai/docs/install) in PATH |
| Windows | `pip install pywinpty` |

## Installation

### Manual

1. Download `main.js`, `styles.css`, `manifest.json` from the [latest release](../../releases/latest)
2. Copy them to `<vault>/.obsidian/plugins/opencode-sidebar/`
3. Reload Obsidian and enable the plugin in Settings → Community Plugins

### Development

```bash
git clone https://github.com/himmel/obsidian-opencode-sidebar
cd obsidian-opencode-sidebar
npm install
# Watch mode (for development):
npm run dev
# Production build:
npm run build
```

Copy `main.js`, `styles.css`, `manifest.json` to your vault's plugin directory.

## Settings

| Setting | Description |
|---------|-------------|
| Default working directory | cwd for new sessions (defaults to vault root) |
| Additional flags | Extra flags passed to `opencode` on startup |
| Color theme | Match Obsidian theme or use terminal default |

## Commands

| Command | Description |
|---------|-------------|
| New session | Open a new OpenCode terminal |
| Focus session | Reveal existing terminal |
| Restart session | Kill and restart current session |
| Toggle YOLO mode | Enable/disable `--dangerously-skip-permissions` |
| Open in current folder | Open terminal in active file's directory |
| Send selection to OpenCode | Send selected editor text to terminal |

## Source Code

Full TypeScript source is in `src/`. The compiled `main.js` is committed for easy installation and auditability. No telemetry, no network calls from the plugin itself.

## License

MIT
