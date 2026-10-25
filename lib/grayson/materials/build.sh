#!/usr/bin/env bash
# Rebuild the loom detail materials kiln reads (lib/grayson/materials/out). Loom stays external: LOOM=<loom checkout>.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); loom=${LOOM:-$HOME/Projects-local/z-Git/uilianks/loom}
node "$loom/bin/loom.js" build "$here/assets.tx.js" --out "$here/out" --no-preview
