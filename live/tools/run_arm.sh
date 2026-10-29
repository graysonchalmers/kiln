#!/usr/bin/env bash
# Envy (bash): one arm of the better-builds eval. Starts a server with the given flags on an OS port, runs the 12 props twice, stops it.
#   run_arm.sh <out-dir> [server flags...]       e.g. run_arm.sh /tmp/x/B --validate
set -uo pipefail
cd "$(dirname "$0")/../.."
OUT="$1"; shift
mkdir -p "$OUT"; rm -f "$OUT"/*.json "$OUT"/results.jsonl "$OUT"/done
python3 live/server/main.py --port 0 --host 127.0.0.1 "$@" > "$OUT/server.log" 2>&1 &
PID=$!
for i in $(seq 90); do P=$(sed -n 's/^PORT=\([0-9]*\).*/\1/p' "$OUT/server.log"); [ -n "$P" ] && break; sleep 1; done
sleep 15   # the pool's warm-up
timeout 2400 python3 live/tools/prompt_eval.py "$P" "$OUT" all > "$OUT/eval.log" 2>&1
kill $PID 2>/dev/null; wait $PID 2>/dev/null
echo DONE > "$OUT/done"
