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

  async onOpen() {
    // Use containerEl (= .workspace-leaf-content) so empty() removes view-header
    // from the DOM entirely, eliminating the gap above the terminal.
    const container = this.containerEl;
    container.empty();
    container.addClass("vault-terminal");
    this.termHost = container.createDiv({ cls: "vault-terminal-host" });
    this.initTerminal();
    // Pick up cwd pre-set by openNewTerminal before setViewState was called
    if (this.plugin.pendingCwd) {
      this.workingDir = this.plugin.pendingCwd;
      this.plugin.pendingCwd = null;
    }
    await this.startSession();
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

    // Initial fit with retry: wait until container has real dimensions
    this.ensureFitWithRetry();
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

  // Retry until the container has real dimensions (Obsidian renders async)
  private async ensureFitWithRetry() {
    for (let i = 0; i < 20; i++) {
      await new Promise<void>(r => setTimeout(r, 100));
      const dim = this.fitAddon?.proposeDimensions();
      if (dim && dim.rows > 0 && dim.cols > 0) {
        this.doFit();
        return;
      }
    }
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
