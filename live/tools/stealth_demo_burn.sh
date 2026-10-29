#!/usr/bin/env bash
# Envy (bash): scripted Godot run on Stealth (Xvfb + software Vulkan, no window anywhere, no GPU lease): a real server on the
# Envy generates the prop, the client presses X four times (25..100 percent burnt) and then C (continuous burn), with a
# screenshot at each step and during each sweep, and the whole run recorded as video.
#   stealth_demo_burn.sh OUTDIR ["prompt"]        -> OUTDIR/*.png and OUTDIR/burn.avi
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="$1"; PROMPT="${2:-wooden barrel with iron hoops and flat wooden heads}"
mkdir -p "$OUT"
IP="$(tailscale ip -4 | head -1)"; LOG="$(mktemp)"
python3 live/server/main.py --port 0 --host "$IP" > "$LOG" 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 40); do PORT="$(sed -n 's/^PORT=\([0-9]*\).*/\1/p' "$LOG")"; [ -n "$PORT" ] && break; sleep 1; done
sleep 9   # the model pool warms up
R=live-blockout-render
ssh stealth "test -x ~/$R/godot && rm -rf ~/$R/client_demo ~/$R/demo_out ~/$R/burn.avi && mkdir -p ~/$R/demo_out" && scp -qr live/client "stealth:$R/client_demo"
HOMEDIR="$(ssh stealth 'echo $HOME')"
ssh stealth "cd ~/$R && VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json nice -n 19 timeout ${TIMEOUT:-900} \
  xvfb-run -a -s '-screen 0 1280x720x24' ./godot --path ./client_demo --rendering-driver vulkan --audio-driver Dummy --resolution 1280x720 \
  --write-movie $HOMEDIR/$R/burn.avi --fixed-fps 30 -- --demo-burn='$PROMPT' --demo-out=$HOMEDIR/$R/demo_out --server=ws://$IP:$PORT --style=implode" 2>&1 | grep -E "shot |demo done|ERROR|SCRIPT" || true
scp -q "stealth:$R/demo_out/*.png" "$OUT/" && scp -q "stealth:$R/burn.avi" "$OUT/burn.avi"
ls "$OUT" | head -40
