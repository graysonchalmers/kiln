#!/usr/bin/env bash
# Hero-view contact sheet from a kiln build: sheet.sh <out_dir> [cols] -> <out_dir>/sheet.png
set -euo pipefail
out=${1:?usage: sheet.sh <out_dir> [cols]}; cols=${2:-4}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
for f in "$out"/_preview/*.png; do
  n=$(basename "$f" .png); [[ $n == *.* || ! -f "$out/models/$n.glb" ]] && continue
  convert "$f" -crop 50%x50%+0+0 +repage -gravity north -splice 0x28 -pointsize 22 -annotate +0+2 "$n" "$tmp/$n.png"
done
montage "$tmp"/*.png -tile "${cols}x" -geometry 450x+3+3 "$out/sheet.png"
echo "$out/sheet.png"
