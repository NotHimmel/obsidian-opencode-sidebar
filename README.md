# obsidian-opencode-sidebar

[English](#english) | [中文](#中文)

---

## English

### Why OpenCode?

Most AI coding assistants in this space — including Claude Code — are commercial, closed-source tools. They route your code and queries through proprietary servers, which raises real privacy concerns: your notes, file contents, and prompts are sent to third-party infrastructure you don't control.

[OpenCode](https://opencode.ai) is an open-source alternative. It runs locally, lets you choose your own model provider (including fully local models via Ollama), and doesn't phone home. For users who keep sensitive information in Obsidian — personal notes, proprietary code, client work — this matters.

This plugin embeds OpenCode in the Obsidian sidebar so you can use it without leaving your workspace.

### Features

- Embedded terminal powered by xterm.js
- Auto-starts OpenCode when you open the panel
- Right-click any folder → "Open OpenCode here"
- Right-click selected text → "Send to OpenCode"
- YOLO mode (skip permissions prompts)
- Obsidian theme-aware ANSI colors
- CJK / IME input support
- Cross-platform: macOS, Linux, Windows
- Full TypeScript source — audit every line

### Requirements

| Platform | Requirement |
|----------|------------|
| All | Python 3, [opencode](https://opencode.ai/docs/install) in PATH |
| Windows | `pip install pywinpty` |

### Installation

**Via BRAT (recommended for beta)**

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Settings → BRAT → Add Beta Plugin → enter this repo URL
3. Enable "OpenCode Sidebar" in Community Plugins

**Manual**

1. Download `main.js`, `styles.css`, `manifest.json` from the [latest release](../../releases/latest)
2. Copy them to `<vault>/.obsidian/plugins/opencode-sidebar/`
3. Reload Obsidian and enable the plugin in Settings → Community Plugins

**Development**

```bash
git clone https://github.com/NotHimmel/obsidian-opencode-sidebar
cd obsidian-opencode-sidebar
npm install
npm run dev    # watch mode
npm run build  # production build
```

### Settings

| Setting | Description |
|---------|-------------|
| Default working directory | cwd for new sessions (defaults to vault root) |
| Additional flags | Extra flags passed to `opencode` on startup |
| Color theme | Match Obsidian theme or use terminal default |

### Commands

| Command | Description |
|---------|-------------|
| New session | Open a new OpenCode terminal |
| Focus session | Reveal existing terminal |
| Restart session | Kill and restart current session |
| Toggle YOLO mode | Enable/disable `--dangerously-skip-permissions` |
| Open in current folder | Open terminal in active file's directory |
| Send selection to OpenCode | Send selected editor text to terminal |

### Source Code

Full TypeScript source is in `src/`. The compiled `main.js` is committed for easy installation and auditability. No telemetry, no network calls from the plugin itself.

### License

MIT

---

## 中文

### 为什么选择 OpenCode？

目前大多数 AI 编程助手——包括 Claude Code——都是商业闭源工具。它们将你的代码和查询内容路由到私有服务器，带来实际的隐私问题：你的笔记、文件内容、提示词都会被发送到你无法控制的第三方基础设施。

[OpenCode](https://opencode.ai) 是一个开源替代品。它在本地运行，允许你选择自己的模型提供商（包括通过 Ollama 使用完全本地化的模型），不会向外发送数据。对于在 Obsidian 中保存敏感信息的用户——个人笔记、私有代码、客户资料——这一点至关重要。

本插件将 OpenCode 嵌入到 Obsidian 侧边栏，让你无需离开工作区即可使用。

### 功能

- 基于 xterm.js 的内嵌终端
- 打开面板时自动启动 OpenCode
- 右键任意文件夹 → "在此处打开 OpenCode"
- 右键选中文本 → "发送到 OpenCode"
- YOLO 模式（跳过权限确认提示）
- 跟随 Obsidian 主题的 ANSI 配色
- CJK / 输入法支持
- 跨平台：macOS、Linux、Windows
- 完整 TypeScript 源码——每一行都可审计

### 环境要求

| 平台 | 要求 |
|------|------|
| 全平台 | Python 3、[opencode](https://opencode.ai/docs/install) 在 PATH 中 |
| Windows | `pip install pywinpty` |

### 安装方式

**通过 BRAT 安装（测试版推荐）**

1. 安装 [BRAT 插件](https://github.com/TfTHacker/obsidian42-brat)
2. 设置 → BRAT → Add Beta Plugin → 输入本仓库地址
3. 在社区插件中启用 "OpenCode Sidebar"

**手动安装**

1. 从 [最新 Release](../../releases/latest) 下载 `main.js`、`styles.css`、`manifest.json`
2. 复制到 `<vault>/.obsidian/plugins/opencode-sidebar/`
3. 重启 Obsidian，在设置 → 社区插件中启用

**开发模式**

```bash
git clone https://github.com/NotHimmel/obsidian-opencode-sidebar
cd obsidian-opencode-sidebar
npm install
npm run dev    # 监听模式
npm run build  # 生产构建
```

### 设置项

| 设置 | 说明 |
|------|------|
| 默认工作目录 | 新会话的起始目录（默认为 vault 根目录） |
| 额外参数 | 启动时追加到 opencode 命令的额外参数 |
| 配色方案 | 跟随 Obsidian 主题 或 使用终端默认配色 |

### 命令

| 命令 | 说明 |
|------|------|
| 新建会话 | 打开新的 OpenCode 终端 |
| 聚焦会话 | 显示已有终端 |
| 重启会话 | 关闭并重新启动当前会话 |
| 切换 YOLO 模式 | 启用/禁用 `--dangerously-skip-permissions` |
| 在当前文件夹打开 | 在当前文件所在目录打开终端 |
| 发送选中内容到 OpenCode | 将编辑器中选中的文字发送到终端 |

### 源码说明

完整 TypeScript 源码位于 `src/` 目录。编译产物 `main.js` 也已提交，方便直接安装和审计。插件本身无遥测、无网络请求。

### 开源协议

MIT
