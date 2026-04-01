import { App, PluginSettingTab, Setting } from "obsidian";
import type OpenCodePlugin from "./main";

export interface PluginData {
  defaultWorkingDir: string | null;
  additionalFlags: string | null;
  lastCwd: string | null;
  ansiTheme: "obsidian" | "default";
}

export const DEFAULT_DATA: PluginData = {
  defaultWorkingDir: null,
  additionalFlags: null,
  lastCwd: null,
  ansiTheme: "obsidian",
};

export class OpenCodeSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: OpenCodePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "OpenCode Sidebar" });

    new Setting(containerEl)
      .setName("Default working directory")
      .setDesc("Leave empty to use vault root. Used for new sessions.")
      .addText((text) =>
        text
          .setPlaceholder("/path/to/dir")
          .setValue(this.plugin.data.defaultWorkingDir || "")
          .onChange(async (value) => {
            this.plugin.data.defaultWorkingDir = value.trim() || null;
            await this.plugin.saveData(this.plugin.data);
          })
      );

    new Setting(containerEl)
      .setName("Additional flags")
      .setDesc("Extra flags appended to the opencode command on startup.")
      .addText((text) =>
        text
          .setPlaceholder("--flag value")
          .setValue(this.plugin.data.additionalFlags || "")
          .onChange(async (value) => {
            this.plugin.data.additionalFlags = value.trim() || null;
            await this.plugin.saveData(this.plugin.data);
          })
      );

    new Setting(containerEl)
      .setName("Color theme")
      .setDesc("Terminal ANSI color palette.")
      .addDropdown((drop) =>
        drop
          .addOption("obsidian", "Match Obsidian theme")
          .addOption("default", "Terminal default")
          .setValue(this.plugin.data.ansiTheme)
          .onChange(async (value) => {
            this.plugin.data.ansiTheme = value as "obsidian" | "default";
            await this.plugin.saveData(this.plugin.data);
          })
      );
  }
}
