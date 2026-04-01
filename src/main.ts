import { Notice, Plugin } from "obsidian";
import { VIEW_TYPE, TerminalView } from "./terminal-view";
import { PluginData, DEFAULT_DATA, OpenCodeSettingTab } from "./settings";
import { registerContextMenus, ensureTerminalView, openNewTerminal } from "./context";

export default class OpenCodePlugin extends Plugin {
  data: PluginData = { ...DEFAULT_DATA };
  pendingCwd: string | null = null;

  async onload() {
    this.data = Object.assign({ ...DEFAULT_DATA }, await this.loadData());

    this.registerView(VIEW_TYPE, (leaf) => new TerminalView(leaf, this));

    this.addRibbonIcon("bot", "Open OpenCode", () =>
      this.activateView()
    );

    this.addCommand({
      id: "new-session",
      name: "New session",
      callback: () => openNewTerminal(this),
    });

    this.addCommand({
      id: "focus-session",
      name: "Focus session",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "restart-session",
      name: "Restart session",
      callback: () => this.getActiveTerminal()?.restartSession(),
    });

    this.addCommand({
      id: "toggle-yolo",
      name: "Toggle YOLO mode (skip permissions)",
      callback: async () => {
        const view = this.getActiveTerminal();
        if (!view) {
          new Notice("No active OpenCode session.");
          return;
        }
        const enabled = view.toggleYolo();
        new Notice(`YOLO mode ${enabled ? "enabled" : "disabled"}. Restarting…`);
        await view.restartSession();
      },
    });

    this.addCommand({
      id: "open-in-current-folder",
      name: "Open in current file's folder",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        const basePath = (this.app.vault.adapter as unknown as { basePath?: string }).basePath ?? "";
        const dir = file?.parent
          ? `${basePath}/${file.parent.path}`
          : basePath;
        await openNewTerminal(this, dir);
      },
    });

    this.addCommand({
      id: "send-selection",
      name: "Send selection to OpenCode",
      editorCallback: async (editor) => {
        const selection = editor.getSelection().trim();
        if (!selection) return;
        const view = await ensureTerminalView(this);
        view?.sendInput(selection);
      },
    });

    this.addSettingTab(new OpenCodeSettingTab(this.app, this));
    registerContextMenus(this);
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (leaves.length > 0) {
      this.app.workspace.revealLeaf(leaves[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  getActiveTerminal(): TerminalView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    return leaves.length > 0 ? (leaves[0].view as TerminalView) : null;
  }
}
