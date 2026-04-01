import type { ITheme } from "@xterm/xterm";

/** Maps Obsidian CSS variables to an xterm.js theme. */
export function getObsidianTheme(): ITheme {
  const s = getComputedStyle(document.body);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    background: v("--background-primary") || "#1e1e2e",
    foreground: v("--text-normal") || "#cdd6f4",
    cursor: v("--text-accent") || "#89b4fa",
    selectionBackground: v("--text-selection") || "#45475a",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#cba6f7",
    cyan: "#89dceb",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#cba6f7",
    brightCyan: "#89dceb",
    brightWhite: "#a6adc8",
  };
}
