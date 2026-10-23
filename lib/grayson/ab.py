#!/usr/bin/env python3
"""Blind A/B set for a judge: ab.py <before_out> <after_out> <ab_dir> <key.json> [extra_before extra_after names]
Copies each asset's 4-view preview (and sheet.png as _kit_sheet) to <ab_dir>/<asset>/{X,Y}.png, randomized per asset.
The key goes to <key.json>, which must sit outside <ab_dir>. Unblind: ab.py --unblind <key.json> asset=X|Y ..."""
import json, os, random, shutil, sys

if sys.argv[1] == "--unblind":
    key = json.load(open(sys.argv[2])); wins = 0
    for kv in sys.argv[3:]:
        a, w = kv.split("="); after = "X" if key[a] == "X=after" else "Y"; wins += w == after
        print(f"{a:18} winner {w} = {'AFTER' if w == after else 'before'}")
    sys.exit(print(f"{wins}/{len(sys.argv) - 3} after wins"))
before, after, ab, keyf = sys.argv[1:5]
pairs = [(n[:-4], f"{before}/_preview/{n}", f"{after}/_preview/{n}") for n in sorted(os.listdir(f"{before}/_preview"))
         if n.endswith(".png") and "." not in n[:-4] and os.path.exists(f"{after}/_preview/{n}") and os.path.exists(f"{before}/models/{n[:-4]}.glb")]
if len(sys.argv) > 5:
    eb, ea, names = sys.argv[5:8]
    pairs += [(n, f"{eb}/_preview/{n}.png", f"{ea}/_preview/{n}.png") for n in names.split(",")]
if os.path.exists(f"{before}/sheet.png"): pairs.append(("_kit_sheet", f"{before}/sheet.png", f"{after}/sheet.png"))
key = {}
for name, b, a in pairs:
    os.makedirs(f"{ab}/{name}", exist_ok=True); flip = random.random() < 0.5
    key[name] = "X=after" if flip else "X=before"
    shutil.copy(a if flip else b, f"{ab}/{name}/X.png"); shutil.copy(b if flip else a, f"{ab}/{name}/Y.png")
json.dump(key, open(keyf, "w"), indent=1); print(f"{len(pairs)} pairs -> {ab}; key -> {keyf}")
