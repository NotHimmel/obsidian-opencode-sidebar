import { spawn, ChildProcess } from "child_process";
import { StringDecoder } from "string_decoder";
import { execSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

export class PtyManager {
  private proc: ChildProcess | null = null;
  private stdoutDecoder = new StringDecoder("utf8");
  private stderrDecoder = new StringDecoder("utf8");

  onData: ((data: string) => void) | null = null;
  onError: ((data: string) => void) | null = null;
  onExit: ((code: number | null) => void) | null = null;

  get isRunning(): boolean {
    return this.proc !== null && !this.proc.killed;
  }

  start(cwd: string, extraFlags: string[], cols: number, rows: number): void {
    if (this.isRunning) this.kill();

    const isWindows = process.platform === "win32";

    // These string literals are replaced by build.sh after bundling
    const PTY_SCRIPT_B64 = "PLACEHOLDER_PTY_SCRIPT_B64";
    const WIN_PTY_SCRIPT_B64 = "PLACEHOLDER_WIN_PTY_SCRIPT_B64";

    // Write PTY script to temp file
    const scriptB64 = isWindows ? WIN_PTY_SCRIPT_B64 : PTY_SCRIPT_B64;
    const scriptName = isWindows ? "opencode_sidebar_win.py" : "opencode_sidebar_pty.py";
    const ptyPath = path.join(os.tmpdir(), scriptName);
    const ptyScript = Buffer.from(scriptB64, "base64").toString("utf-8");
    fs.writeFileSync(ptyPath, ptyScript, { mode: 0o755 });

    // Detect Python executable
    const python = this.detectPython(isWindows);

    // Build opencode command string
    const flags = extraFlags.join(" ");
    const opencodeCmd = flags ? `opencode ${flags}` : "opencode";

    // Build spawn arguments
    let args: string[];
    let shellEnv = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" };

    if (isWindows) {
      const winShell = process.env.COMSPEC || "cmd.exe";
      // /k keeps the window open after opencode exits
      const winCmd = `${winShell} /k ${opencodeCmd}`;
      args = [ptyPath, String(cols), String(rows), winCmd];
    } else {
      const shell = process.env.SHELL || "/bin/bash";
      // Login shell ensures PATH includes user's tool installs (nvm, brew, etc.)
      const shellCmd = `${opencodeCmd} || true; exec ${shell} -i`;
      args = [ptyPath, String(cols), String(rows), shell, "-lc", shellCmd];

      // Inherit PATH from user's login shell (GUI apps lose shell config)
      shellEnv = this.getLoginShellEnv(shell, shellEnv);

      // Ensure common opencode install locations are in PATH
      const homeDir = process.env.HOME || "";
      const extraPaths = [`${homeDir}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin"];
      for (const p of extraPaths) {
        if (p && shellEnv.PATH && !shellEnv.PATH.includes(p)) {
          shellEnv.PATH = `${p}:${shellEnv.PATH}`;
        }
      }
    }

    this.proc = spawn(python, args, {
      cwd,
      env: shellEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout?.on("data", (data: Buffer) => {
      this.onData?.(this.stdoutDecoder.write(data));
    });

    this.proc.stderr?.on("data", (data: Buffer) => {
      this.onError?.(this.stderrDecoder.write(data));
    });

    this.proc.on("close", (code) => {
      this.proc = null;
      this.onExit?.(code);
    });

    this.proc.on("error", (err) => {
      this.onError?.(`\r\nFailed to start process: ${err.message}\r\n`);
    });
  }

  write(data: string): void {
    // Convert to Buffer so ASCII bytes are identical to "binary" mode
    // while multi-byte chars (e.g. Chinese) are correctly UTF-8 encoded.
    this.proc?.stdin?.write(Buffer.from(data, "utf8"));
  }

  resize(cols: number, rows: number): void {
    this.proc?.stdin?.write(Buffer.from(`\x1b]RESIZE;${cols};${rows}\x07`, "utf8"));
  }

  kill(): void {
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
  }

  private detectPython(isWindows: boolean): string {
    if (!isWindows) return "python3";

    // Use where.exe to resolve the full executable path for each candidate.
    // Returning just the command name (e.g. "py") causes "spawn py ENOENT"
    // because Node spawn uses a direct PATH lookup while execSync uses the
    // cmd.exe shell — they don't always resolve the same locations.
    for (const cmd of ["py", "python3", "python"]) {
      try {
        const out = execSync(`where.exe ${cmd}`, { encoding: "utf8", timeout: 2000 });
        const paths = out
          .split(/\r?\n/)
          .map((p) => p.trim())
          .filter((p) => p && !p.includes("WindowsApps"));
        const bat = paths.find((p) => p.toLowerCase().endsWith(".bat"));
        if (bat) return bat;
        if (paths.length > 0) return paths[0];
      } catch {}
    }

    return "python";
  }

  private getLoginShellEnv(
    shell: string,
    fallback: NodeJS.ProcessEnv
  ): NodeJS.ProcessEnv {
    try {
      const out = execSync(`${shell} -lic 'echo "__PATH__"; echo "$PATH"'`, {
        encoding: "utf8",
        timeout: 3000,
      });
      const shellPath = out.split("__PATH__\n")[1]?.trim().split("\n")[0];
      if (shellPath) return { ...fallback, PATH: shellPath };
    } catch {}
    return fallback;
  }
}
