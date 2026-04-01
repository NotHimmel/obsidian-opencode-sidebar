import { TFolder, Menu } from "obsidian";
import type OpenCodePlugin from "./main";
import { VIEW_TYPE, TerminalView } from "./terminal-view";

export function registerContextMenus(plugin: OpenCodePlugin): void {
  // Folder right-click → open OpenCode in that directory
  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu: Menu, file) => {
      if (!(file instanceof TFolder)) return;
      menu.addItem((item) => {
        item
          .setTitle("Open OpenCode here")
          .setIcon("bot")
          .onClick(async () => {
            const basePath = getBasePath(plugin);
            const cwd = basePath ? `${basePath}/${file.path}` : file.path;
            await openNewTerminal(plugin, cwd);
          });
      });
    })
  );

  // Text selection right-click → send to OpenCode
  plugin.registerEvent(
    plugin.app.workspace.on("editor-menu", (menu: Menu, editor) => {
      const selection = editor.getSelection().trim();
      if (!selection) return;
      menu.addItem((item) => {
        item
          .setTitle("Send to OpenCode")
          .setIcon("bot")
          .onClick(async () => {
            const view = await ensureTerminalView(plugin);
            view?.sendInput(selection);
          });
      });
    })
  );
}

export async function openNewTerminal(
  plugin: OpenCodePlugin,
  cwd?: string
): Promise<TerminalView | null> {
  const leaf = plugin.app.workspace.getRightLeaf(false);
  if (!leaf) return null;
  await leaf.setViewState({ type: VIEW_TYPE, active: true });
  plugin.app.workspace.revealLeaf(leaf);
  const view = leaf.view as TerminalView;
  if (cwd) {
    view.workingDir = cwd;
    await view.startSession(cwd);
  }
  return view;
}

export async function ensureTerminalView(
  plugin: OpenCodePlugin
): Promise<TerminalView | null> {
  // Reuse existing terminal if open
  const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE);
  if (leaves.length > 0) {
    plugin.app.workspace.revealLeaf(leaves[0]);
    return leaves[0].view as TerminalView;
  }
  return openNewTerminal(plugin);
}

function getBasePath(plugin: OpenCodePlugin): string {
  return (
    (plugin.app.vault.adapter as unknown as { basePath?: string }).basePath ?? ""
  );
}
