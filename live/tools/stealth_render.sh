#!/usr/bin/env bash
# Envy (bash): render the Godot client on Stealth with no window anywhere: Xvfb plus software Vulkan (lavapipe), through godot-q (Stealth CPU slots, nice 10).
# Needs ~/live-blockout-render/godot on Stealth (the official Godot 4.7.2 Linux build; check its SHA512 when you download).
#   stealth_render.sh <local-out-file> <godot args...>     "@OUT@" in the args becomes the output path on Stealth
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT_LOCAL="$1"; shift
R=live-blockout-render
ssh stealth "test -x ~/$R/godot" || { echo "no ~/$R/godot on Stealth"; exit 2; }
python3 live/tools/make_prop_fixtures.py >/dev/null
ssh stealth "rm -rf ~/$R/client ~/$R/out.* && mkdir -p ~/$R" && scp -qr live/client "stealth:$R/client"
ROUT="$(ssh stealth 'echo $HOME')/$R/out.${OUT_LOCAL##*.}"
ARGS=("${@//@OUT@/$ROUT}")
printf -v ARGSTR '%q ' "${ARGS[@]}"
ssh stealth "cd ~/$R && VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
  xvfb-run -a -s '-screen 0 1280x720x24' ~/.local/bin/godot-q -n blockout-render --max ${TIMEOUT:-420} --exe ./godot -- --path ./client --rendering-driver vulkan --audio-driver Dummy $ARGSTR" 2>&1 | grep -vE "ALSA|audio" | tail -5 || true
scp -q "stealth:$R/out.${OUT_LOCAL##*.}" "$OUT_LOCAL"
echo "rendered $OUT_LOCAL ($(stat -c %s "$OUT_LOCAL") bytes)"
