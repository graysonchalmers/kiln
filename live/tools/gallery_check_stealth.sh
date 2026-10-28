#!/usr/bin/env bash
# Envy (bash): windowless visual regression. Renders the 13-prop gallery on Stealth (Xvfb + software Vulkan) and compares it
# with live/client/tests/baselines/gallery_stealth.png by SSIM. Software and GPU renders differ in the last pixels, so this
# has its own baseline (the Legion one is for gallery_check.sh).
#   gallery_check_stealth.sh            compare; exit 1 below THRESHOLD (default 0.985)
#   gallery_check_stealth.sh --update   accept the new look as the baseline
set -euo pipefail
cd "$(dirname "$0")/../.."
THRESHOLD="${THRESHOLD:-0.985}"
BASE=live/client/tests/baselines/gallery_stealth.png
NEW="$(mktemp -d)/gallery.png"
live/tools/stealth_render.sh "$NEW" --resolution 1280x720 --quit-after 300 -- --gallery --style=flip "--shot=@OUT@"
if [ "${1:-}" = "--update" ]; then cp "$NEW" "$BASE"; echo "baseline updated"; exit 0; fi
ssim=$(ffmpeg -loglevel info -i "$NEW" -i "$BASE" -lavfi ssim -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p' | tail -1)
echo "SSIM $ssim (threshold $THRESHOLD)"
python3 -c "import sys; sys.exit(0 if float('$ssim') >= float('$THRESHOLD') else 1)" && echo PASS || { echo "FAIL: shot differs from baseline: $NEW"; exit 1; }
