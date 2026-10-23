#!/usr/bin/env bash
# Golden library: freeze approved assets (dims, tris, hero image), then check later builds against them.
# Scene paths are stored relative to the repo root, so a check in a worktree tests the worktree.
#   golden.sh save  <scene.kx.js> <name,name,...>   record approved assets into lib/grayson/golden/
#   golden.sh check                                  rebuild every golden asset, flag changed dims/tris/image
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd); kiln="node $root/bin/kiln.js"; g="$here/golden"
mkdir -p "$g"
case "${1:-}" in
  save)
    scene=$(realpath --relative-to="$root" "$2"); tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
    $kiln build "$root/$scene" --out "$tmp" --only "$3" | grep '^model' | while read -r _ name dims tris _; do
      printf '%s\t%s\t%s\t%s\n' "$name" "$scene" "$dims" "$tris" > "$g/$name.tsv"
      convert "$tmp/_preview/$name.png" -crop 50%x50%+0+0 +repage "$g/$name.png"
      echo "golden: $name $dims $tris tris"
    done ;;
  check)
    tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT; fail=0
    for f in "$g"/*.tsv; do
      IFS=$'\t' read -r name scene dims tris < "$f"
      line=$($kiln build "$root/$scene" --out "$tmp/$name" --only "$name" | grep "^model $name ")
      read -r _ _ ndims ntris _ <<< "$line"
      convert "$tmp/$name/_preview/$name.png" -crop 50%x50%+0+0 +repage "$tmp/$name.png"
      diff=$( (compare -metric RMSE "$g/$name.png" "$tmp/$name.png" null: 2>&1 || true) | sed -E 's/.*\(([0-9.e-]+)\).*/\1/')
      ok=$(awk -v d="$diff" 'BEGIN { print (d < 0.02) ? 1 : 0 }')
      if [[ $ndims == "$dims" && $ntris == "$tris" && $ok == 1 ]]; then echo "ok    $name"
      else echo "DRIFT $name  dims $dims->$ndims  tris $tris->$ntris  image rmse $diff"; fail=1; fi
    done
    exit $fail ;;
  *) sed -n 2,4p "$0"; exit 2 ;;
esac
