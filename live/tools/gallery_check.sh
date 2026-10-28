#!/usr/bin/env bash
# Envy (bash): visual regression for the client. Pushes the client to the Legion, renders the 13-prop gallery in a
# Godot window there (it flashes for a few seconds), fetches the shot and compares it with the baseline by SSIM.
#   gallery_check.sh            compare; exit 1 below THRESHOLD (default 0.985)
#   gallery_check.sh --update   replace the baseline with the new shot (do this only for a change you meant to make)
set -euo pipefail
cd "$(dirname "$0")/../.."
THRESHOLD="${THRESHOLD:-0.985}"
BASE=live/client/tests/baselines/gallery.png
NEW="$(mktemp -d)/gallery.png"
python3 live/tools/make_prop_fixtures.py >/dev/null
scp -q live/client/*.gd live/client/*.gdshader live/client/project.godot live/client/main.tscn legion:C:/Users/Grayson/claude-tmp/live-client/
scp -q live/client/tests/props/*.json legion:C:/Users/Grayson/claude-tmp/live-client/tests/props/
scp -q live/client/tests/task_gallery.ps1 legion:C:/Users/Grayson/claude-tmp/live-client/tests/
ssh legion 'powershell -NoProfile -File C:\Users\Grayson\claude-tmp\live-client\tests\task_gallery.ps1' | tail -1
scp -q legion:C:/Users/Grayson/claude-tmp/smoke/gallery.png "$NEW"
if [ "${1:-}" = "--update" ]; then cp "$NEW" "$BASE"; echo "baseline updated"; exit 0; fi
ssim=$(ffmpeg -loglevel info -i "$NEW" -i "$BASE" -lavfi ssim -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p' | tail -1)
echo "SSIM $ssim (threshold $THRESHOLD)"
python3 -c "import sys; sys.exit(0 if float('$ssim') >= float('$THRESHOLD') else 1)" && echo PASS || { echo "FAIL: shot differs from baseline: $NEW"; exit 1; }
