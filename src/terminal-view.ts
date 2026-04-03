import { ItemView, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type OpenCodePlugin from "./main";
import { PtyManager } from "./pty-manager";
import { getObsidianTheme } from "./theme";

export const VIEW_TYPE = "opencode-terminal";

export class TerminalView extends ItemView {
  private term: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private pty: PtyManager = new PtyManager();
  private resizeObserver: ResizeObserver | null = null;
  private termHost: HTMLElement | null = null;
  private fitDebounce: ReturnType<typeof setTimeout> | null = null;
  private userScrolledAt = 0;

  // Set by folder context menu before startSession()
  workingDir: string | null = null;
  yoloMode = false;

  constructor(leaf: WorkspaceLeaf, private plugin: OpenCodePlugin) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "OpenCode"; }
  getIcon() { return "bot"; }

  private injectCSS() {
    if (document.getElementById("xterm-css")) return;
    const style = document.createElement("style");
    style.id = "xterm-css";
    style.textContent = `
.xterm { cursor: text; position: relative; user-select: none; -ms-user-select: none; -webkit-user-select: none; }
.xterm.focus, .xterm:focus { outline: none; }
.xterm .xterm-helpers { position: absolute; top: 0; z-index: 5; }
.xterm .xterm-helper-textarea { padding: 0; border: 0; margin: 0; position: absolute; opacity: 0; left: -9999em; top: 0; width: 0; height: 0; z-index: -5; white-space: nowrap; overflow: hidden; resize: none; }
.xterm .composition-view { background: #000; color: #FFF; display: none; position: absolute; white-space: nowrap; z-index: 1; }
.xterm .composition-view.active { display: block; }
.xterm .xterm-viewport { background-color: #000; overflow-y: scroll; cursor: default; position: absolute; right: 0; left: 0; top: 0; bottom: 0; }
.xterm .xterm-screen { position: relative; }
.xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
.xterm .xterm-scroll-area { visibility: hidden; }
.xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; top: 0; left: -9999em; line-height: normal; }
.xterm.enable-mouse-events { cursor: default; }
.xterm.xterm-cursor-pointer, .xterm .xterm-cursor-pointer { cursor: pointer; }
.xterm.column-select.focus { cursor: crosshair; }
.xterm .xterm-accessibility:not(.debug), .xterm .xterm-message { position: absolute; left: 0; top: 0; bottom: 0; right: 0; z-index: 10; color: transparent; pointer-events: none; }
.xterm .xterm-accessibility-tree:not(.debug) *::selection { color: transparent; }
.xterm .xterm-accessibility-tree { user-select: text; white-space: pre; }
.xterm .live-region { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.xterm-dim { opacity: 1 !important; }
.xterm-underline-1 { text-decoration: underline; }
.xterm-underline-2 { text-decoration: double underline; }
.xterm-underline-3 { text-decoration: wavy underline; }
.xterm-underline-4 { text-decoration: dotted underline; }
.xterm-underline-5 { text-decoration: dashed underline; }
.xterm-overline { text-decoration: overline; }
.xterm-strikethrough { text-decoration: line-through; }
.xterm-screen .xterm-decoration-container .xterm-decoration { z-index: 6; position: absolute; }
.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer { z-index: 7; }
.xterm-decoration-overview-ruler { z-index: 8; position: absolute; top: 0; right: 0; pointer-events: none; }
.xterm-decoration-top { z-index: 2; position: relative; }
`;
    document.head.appendChild(style);
  }

  async onOpen() {
    this.injectCSS();
    const container = this.containerEl;
    container.empty();
    container.addClass("vault-terminal");
    this.termHost = container.createDiv({ cls: "vault-terminal-host" });
    if (this.plugin.pendingCwd) {
      this.workingDir = this.plugin.pendingCwd;
      this.plugin.pendingCwd = null;
    }

    // Initialize terminal immediately (before container has real pixel dimensions).
    // This mirrors claude-sidebar's pattern: term.open() with a 0-dim container
    // means xterm starts at its default size (80×24). When ensureFitWithRetry()
    // later calls fit() with real dimensions, term.resize() is a genuine size
    // change → triggers a full canvas repaint. If we wait for real dims before
    // term.open(), xterm starts at the correct size and fit() becomes a no-op,
    // leaving the canvas without a proper initial repaint.
    this.initTerminal();

    // Start the PTY almost immediately so it is running when ensureFitWithRetry
    // fires (~100 ms later) and sends the first resize/SIGWINCH.
    setTimeout(() => {
      if (!this.pty.isRunning) this.startSession();
    }, 10);

    // Background: poll until xterm has valid char-cell dims, then fit.
    // term.onResize() registered in initTerminal() will forward the resulting
    // resize to the PTY automatically.
    this.ensureFitWithRetry();
  }

  private async ensureFitWithRetry() {
    for (let i = 0; i < 20; i++) {
      await new Promise<void>(r => setTimeout(r, 100));
      const dim = this.fitAddon?.proposeDimensions();
      if (dim && dim.rows > 0) {
        this.doFit();
        // Also send resize explicitly in case PTY is already running
        if (this.pty.isRunning) {
          this.pty.resize(this.term!.cols, this.term!.rows);
        }
        return;
      }
    }
  }

  private initTerminal() {
    const theme =
      this.plugin.data.ansiTheme === "obsidian" ? getObsidianTheme() : {};

    this.term = new Terminal({
      theme,
      fontFamily: "monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.termHost!);

    // Forward keyboard/paste input to PTY
    this.term.onData((data) => this.pty.write(data));

    // Forward every xterm resize to the PTY so the child process always has
    // the correct terminal dimensions (also sends SIGWINCH via terminal_pty.py).
    this.term.onResize(({ cols, rows }) => {
      if (this.pty.isRunning) this.pty.resize(cols, rows);
    });

    // Track user scrolls to pause auto-scroll
    const viewport = this.termHost!.querySelector(".xterm-viewport");
    if (viewport) {
      viewport.addEventListener("scroll", () => {
        const el = viewport as HTMLElement;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
        if (!atBottom) this.userScrolledAt = Date.now();
        else this.userScrolledAt = 0;
      });
    }

    // Fit on resize (sidebar drag, panel resize, etc.)
    this.resizeObserver = new ResizeObserver(() => this.scheduleFit());
    this.resizeObserver.observe(this.termHost!);

    // Also refit on Obsidian layout changes (sidebar show/hide, pane splits)
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.scheduleFit())
    );
  }

  private scheduleFit() {
    if (this.fitDebounce) clearTimeout(this.fitDebounce);
    this.fitDebounce = setTimeout(() => this.doFit(), 50);
  }

  private doFit() {
    if (!this.fitAddon || !this.term) return;
    try {
      const userScrolled = Date.now() - this.userScrolledAt < 5000;
      const atBottom = !userScrolled &&
        this.term.buffer.active.baseY === this.term.buffer.active.viewportY;
      const savedY = this.term.buffer.active.viewportY;

      this.fitAddon.fit();
      this.pty.resize(this.term.cols, this.term.rows);

      if (atBottom) {
        this.term.scrollToBottom();
      } else if (this.term.buffer.active.viewportY !== savedY) {
        this.term.scrollToLine(savedY);
      }
    } catch {}
  }

  private resolveCwd(): string {
    if (this.workingDir) return this.workingDir;
    if (this.plugin.data.lastCwd) return this.plugin.data.lastCwd;
    if (this.plugin.data.defaultWorkingDir) return this.plugin.data.defaultWorkingDir;
    // Fall back to vault root
    return (this.app.vault.adapter as unknown as { basePath: string }).basePath
      ?? process.cwd();
  }

  async startSession(cwd?: string) {
    const workingDir = cwd ?? this.resolveCwd();
    const cols = this.term?.cols ?? 80;
    const rows = this.term?.rows ?? 24;

    const flags: string[] = [];
    if (this.yoloMode) flags.push("--dangerously-skip-permissions");
    const extra = this.plugin.data.additionalFlags;
    if (extra) flags.push(...extra.split(/\s+/).filter(Boolean));

    this.pty.onData = (data) => {
      if (!this.term) return;
      const buf = this.term.buffer.active;
      const userScrolled = Date.now() - this.userScrolledAt < 5000;
      const atBottom = !userScrolled && buf.baseY === buf.viewportY;
      const savedY = buf.viewportY;
      this.term.write(data);
      if (atBottom) {
        this.term.scrollToBottom();
      } else {
        if (buf.viewportY !== savedY) {
          this.term.scrollToLine(savedY);
        }
      }
    };

    this.pty.onError = (data) => {
      this.term?.write(`\x1b[31m${data}\x1b[0m`);
    };

    this.pty.onExit = (_code) => {
      this.term?.write(
        "\r\n\x1b[33m[Process exited]\x1b[0m\r\n"
      );
      this.showRestartButton(workingDir);
    };

    try {
      this.pty.start(workingDir, flags, cols, rows);
    } catch (err) {
      this.term?.write(`\x1b[31mFailed to start: ${err}\x1b[0m\r\n`);
    }

    // Give focus to the terminal so keyboard input works immediately
    setTimeout(() => this.term?.focus(), 500);

    this.plugin.data.lastCwd = workingDir;
    await this.plugin.saveData(this.plugin.data);
  }

  private showRestartButton(cwd: string) {
    const btn = this.termHost!.createEl("button", {
      text: "Restart session",
      cls: "vault-terminal-restart",
    });
    btn.addEventListener("click", async () => {
      btn.remove();
      this.term?.clear();
      await this.startSession(cwd);
    });
  }

  async restartSession() {
    this.pty.kill();
    this.term?.clear();
    this.termHost?.querySelectorAll(".vault-terminal-restart").forEach((el) => el.remove());
    await this.startSession();
  }

  toggleYolo(): boolean {
    this.yoloMode = !this.yoloMode;
    return this.yoloMode;
  }

  sendInput(text: string) {
    this.pty.write(text);
    this.pty.write("\n");
  }

  async onClose() {
    this.resizeObserver?.disconnect();
    if (this.fitDebounce) clearTimeout(this.fitDebounce);
    this.pty.kill();
    this.term?.dispose();
    this.term = null;
    this.fitAddon = null;
  }
}
