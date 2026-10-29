#!/usr/bin/env bash
# Envy (bash): the key-driven demo (--demo-keys: X, C, [ and ] as real key events) in a REAL Godot window on the Envy's own display
# (Intel UHD / Vulkan), against a local server. A window opens on the Envy screen for about a minute. Needs the Godot 4.7.2 Linux
# binary at ~/.cache/live-blockout-render/godot (the same file as on Stealth) and a logged-in graphical session (X display :0).
#   envy_demo_keys.sh OUTDIR ["prompt"]      -> OUTDIR/k*.png and OUTDIR/demo.log
# Heavy: run it through  envy-heavy -n godot-real --envy-only -- live/tools/envy_demo_keys.sh OUTDIR
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="$(realpath -m "$1")"; PROMPT="${2:-wooden barrel with iron hoops and flat wooden heads}"
GODOT="${GODOT:-$HOME/.cache/live-blockout-render/godot}"
mkdir -p "$OUT"; rm -f "$OUT"/k*.png "$OUT/demo.log"
LOG="$(mktemp)"
python3 live/server/main.py --port 0 --host 127.0.0.1 > "$LOG" 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 40); do PORT="$(sed -n 's/^PORT=\([0-9]*\).*/\1/p' "$LOG")"; [ -n "$PORT" ] && break; sleep 1; done
sleep 9   # the model pool warms up
DISPLAY="${DISPLAY:-:0}" timeout "${TIMEOUT:-240}" "$GODOT" --path live/client --rendering-driver vulkan --resolution 1280x720 --audio-driver Dummy \
  -- "--demo-keys=$PROMPT" "--demo-out=$OUT" "--server=ws://127.0.0.1:$PORT" --style=implode 2>&1 | grep -E "Vulkan|ERROR|SCRIPT|demo done" || true
ls "$OUT"; echo "--- demo.log"; tail -12 "$OUT/demo.log" 2>/dev/null || echo "(no demo.log: the window never got going)"
