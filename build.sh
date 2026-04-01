#!/bin/bash
# Embeds Python PTY scripts into main.js as base64 after esbuild bundling.
# Run automatically by: npm run build

set -e

JS_FILE="main.js"

if [ ! -f "$JS_FILE" ]; then
  echo "Error: $JS_FILE not found. Run esbuild first." >&2
  exit 1
fi

if [ -f "scripts/terminal_pty.py" ]; then
  B64=$(base64 -i "scripts/terminal_pty.py" | tr -d '\n')
  sed -i'' "s|PTY_SCRIPT_B64 = \"[^\"]*\"|PTY_SCRIPT_B64 = \"$B64\"|" "$JS_FILE"
  echo "✓ Embedded scripts/terminal_pty.py"
else
  echo "Warning: scripts/terminal_pty.py not found" >&2
fi

if [ -f "scripts/terminal_win.py" ]; then
  WIN_B64=$(base64 -i "scripts/terminal_win.py" | tr -d '\n')
  sed -i'' "s|WIN_PTY_SCRIPT_B64 = \"[^\"]*\"|WIN_PTY_SCRIPT_B64 = \"$WIN_B64\"|" "$JS_FILE"
  echo "✓ Embedded scripts/terminal_win.py"
else
  echo "Warning: scripts/terminal_win.py not found" >&2
fi
