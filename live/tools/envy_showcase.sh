#!/usr/bin/env bash
# Envy (bash): the showcase on the Envy's own GPU in real Godot windows (Intel/NVIDIA via Vulkan on display :0; windows open for
# about half a minute each): a real server generates each prop, the client films one full turn around it and then its burn
# (--demo-turn, Movie Maker), then the two 13-prop galleries are rendered on this GPU and compared with the Stealth baselines.
#   envy_showcase.sh OUTDIR       -> OUTDIR/<prop>/{t_*.png,b_*.png,demo.log}, OUTDIR/<prop>.mp4, OUTDIR/gallery_gpu*.png
# Heavy: run it through  envy-heavy -n showcase --envy-only -- live/tools/envy_showcase.sh OUTDIR
set -uo pipefail
cd "$(dirname "$0")/../.."
OUT="$(realpath -m "$1")"; GODOT="${GODOT:-$HOME/.cache/live-blockout-render/godot}"
mkdir -p "$OUT"
PROPS=(
 "potion|stylised potion bottle: round glass flask with a long neck, a cork stopper and glowing liquid inside@0.5,0.8,0.5"
 "lantern|stylised hanging lantern: metal frame, a glowing flame inside glass panes, a top ring and a base@0.5,0.9,0.5"
 "chest|stylised treasure chest: wooden body, rounded lid, iron bands, a gold lock@0.9,0.6,0.55"
 "mushroom|stylised mushroom house: big red spotted cap roof, cream round stem with a small door and a window@1.0,1.1,1.0"
 "signpost|stylised wooden signpost: a tall post with two arrow-shaped planks pointing opposite ways@0.8,1.6,0.25"
 "bucket|stylised wooden water bucket: tapered wooden staves, two iron hoops, a rope handle arching over the top@0.5,0.55,0.5"
 "barrel|wooden barrel with iron hoops and flat wooden heads@0.75,0.95,0.75"
)
LOG="$(mktemp)"
python3 live/server/main.py --port 0 --host 127.0.0.1 > "$LOG" 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 40); do PORT="$(sed -n 's/^PORT=\([0-9]*\).*/\1/p' "$LOG")"; [ -n "$PORT" ] && break; sleep 1; done
sleep 9
export DISPLAY="${DISPLAY:-:0}"
for item in "${PROPS[@]}"; do
  name="${item%%|*}"; spec="${item#*|}"
  if [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $name "* ]]; then continue; fi
  mkdir -p "$OUT/$name"; rm -f "$OUT/$name"/*.png "$OUT/$name/demo.log" "$OUT/$name.avi"
  echo "== $name $(date +%-I:%M:%S)"
  timeout "${PROP_TIMEOUT:-200}" "$GODOT" --path live/client --rendering-driver vulkan --resolution 1280x720 --audio-driver Dummy \
    --write-movie "$OUT/$name.avi" --fixed-fps 30 \
    -- "--demo-turn=$spec" "--demo-out=$OUT/$name" "--server=ws://127.0.0.1:$PORT" --style=implode 2>&1 | grep -E "Vulkan|ERROR|SCRIPT" | head -3
  tail -2 "$OUT/$name/demo.log" 2>/dev/null
  [ -f "$OUT/$name.avi" ] && ffmpeg -loglevel error -y -i "$OUT/$name.avi" -vf "scale=960:-2" -c:v libx264 -pix_fmt yuv420p -crf 25 "$OUT/$name.mp4" && rm -f "$OUT/$name.avi"
done
kill $SRV 2>/dev/null || true
[ -n "${ONLY:-}" ] && { ls "$OUT"; exit 0; }   # ONLY="potion chest": just those props, no galleries
echo "== galleries on this GPU $(date +%-I:%M:%S)"
python3 live/tools/make_prop_fixtures.py > /dev/null
for set in "" burnt; do
  shot="$OUT/gallery_gpu${set:+_$set}.png"; rm -f "$shot"
  timeout 120 "$GODOT" --path live/client --rendering-driver vulkan --resolution 1280x720 --quit-after 300 --audio-driver Dummy \
    -- --gallery ${set:+--gallery-set=$set} --style=flip "--shot=$shot" 2>&1 | grep -E "Vulkan|ERROR|SCRIPT" | head -2
  base="live/client/tests/baselines/gallery_stealth${set:+_$set}.png"
  if [ -f "$shot" ]; then
    ssim=$(ffmpeg -loglevel info -i "$shot" -i "$base" -lavfi ssim -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p' | tail -1)
    echo "gallery${set:+ ($set)} on this GPU vs Stealth baseline: SSIM $ssim"
  else echo "gallery${set:+ ($set)}: no shot"; fi
done
ls "$OUT"
