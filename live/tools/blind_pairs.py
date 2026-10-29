#!/usr/bin/env python3
"""Blind sheets for two arms: every (prop, run) pair rendered with the same iso renderer as the earlier rounds, left/right shuffled.
usage: blind_pairs.py ARM_X_DIR ARM_Y_DIR OUTDIR [seed]
Writes OUTDIR/sheet1.png, sheet2.png (12 pairs each; tiles are labelled 01L 01R ...), and OUTDIR/mapping_DO_NOT_READ_BEFORE_PICKS.json
(pair -> which arm is on the left). Write your picks to OUTDIR/picks.json ({"01": "L"|"R"|"="}) BEFORE opening the mapping."""
import json, pathlib, random, subprocess, sys
JS = ("import {renderVoxelIso,encodePng} from '/home/graysonchalmers/Projects-local/Tool-GameKit/lib/voxel-iso.mjs';import fs from 'node:fs';"
      "const g=JSON.parse(fs.readFileSync(process.argv[1]));const r=renderVoxelIso({...g,px:96,yaw:35,pitch:25});fs.writeFileSync(process.argv[2],encodePng(r.w,r.h,r.rgba))")


def render(f: pathlib.Path, out: pathlib.Path) -> bool:
    if not f.exists():
        return False
    g = json.loads(f.read_text())
    g.pop("materials", None); g.pop("checks", None); g["palette"].pop("_", None)
    tmp = out.with_suffix(".tmp.json"); tmp.write_text(json.dumps(g))
    subprocess.run(["node", "--input-type=module", "-e", JS, str(tmp), str(out)], check=True)
    tmp.unlink()
    return True


def blank(path: pathlib.Path):
    subprocess.run(["convert", "-size", "200x200", "xc:#333333", "-fill", "#aaa", "-gravity", "center", "-annotate", "0", "FAILED", str(path)], check=True)


def main(x, y, out, seed=20261029):
    x, y, out = pathlib.Path(x), pathlib.Path(y), pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    names = sorted({p.stem for p in list(x.glob("*_[12].json")) + list(y.glob("*_[12].json"))}, key=lambda s: (s.split("_")[1], s))
    mapping, tiles = {}, []
    for i, name in enumerate(names, 1):
        pid = f"{i:02d}"
        flip = rng.random() < 0.5
        left, right = (y, x) if flip else (x, y)
        mapping[pid] = {"name": name, "L": left.name, "R": right.name}
        for side, arm in (("L", left), ("R", right)):
            png = out / f"{pid}{side}.png"
            if not render(arm / f"{name}.json", png):
                blank(png)
            tiles.append((pid + side, png))
    for s in range(0, len(tiles), 24):
        chunk = tiles[s:s + 24]
        cmd = ["montage"]
        for label, png in chunk:
            cmd += ["-label", label, str(png)]
        cmd += ["-tile", "8x", "-geometry", "200x200+3+3", "-background", "#222222", "-fill", "white", "-pointsize", "18", str(out / f"sheet{s // 24 + 1}.png")]
        subprocess.run(cmd, check=True)
    (out / "mapping_DO_NOT_READ_BEFORE_PICKS.json").write_text(json.dumps(mapping))
    print(f"{len(names)} pairs; sheets written; mapping not printed")


main(*sys.argv[1:4], *(int(a) for a in sys.argv[4:5]))
