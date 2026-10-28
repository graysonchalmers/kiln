#!/usr/bin/env python3
"""Barrel with a real inside: staves, hoops, two heads with battens and hollow air between them, then intact / cutaway /
burnt states rendered with Tool-GameKit's voxel-iso (iso sprite). usage: insides_demo.py OUTDIR   (writes 3 pngs + a sheet)"""
import json, pathlib, subprocess, sys
import numpy as np
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "server"))
from damage import damage  # noqa: E402
from ladder import eval_master, eval_materials, eval_palette, level_cells, master_runs, solidify  # noqa: E402

PAL = ('pal({s:"#9c6a4d",h:{color:"#3a3a3a",mat:"structural"},e:"#b58a5e",b:{color:"#6e4a30",mat:"structural"}})')
# s staves (outer wall, 0.05 thick), h hoops, e heads, b head battens (cross boards), _ = hollow air between the heads
F = ('function f(u,v,w){const x=u-.5,z=w-.5,r=Math.hypot(x,z),R=.4+.07*Math.sin(Math.PI*v)\n'
     'if(r>R)return null\n'
     'if(r>R-.012&&(Math.abs(v-.18)<.03||Math.abs(v-.5)<.025||Math.abs(v-.82)<.03))return "h"\n'
     'if(v<.07||v>.93)return r>R-.05?"s":(Math.abs(x)<.06?"b":"e")\n'
     'if(v<.1||v>.9)return r>R-.05?"s":(Math.abs(x)<.06?"b":"e")\n'
     'if(r>R-.05)return "s"\nreturn "_"}')

def render(grid, path, px=84):
    js = ("import {renderVoxelIso,encodePng} from '%s/lib/voxel-iso.mjs';import fs from 'node:fs';"
          "const g=JSON.parse(fs.readFileSync(process.argv[1]));const r=renderVoxelIso({...g,px:%d,yaw:35,pitch:25});"
          "fs.writeFileSync(process.argv[2],encodePng(r.w,r.h,r.rgba))" % (pathlib.Path.home() / "Projects-local/Tool-GameKit", px))
    tmp = pathlib.Path(path).with_suffix(".json"); tmp.write_text(json.dumps(grid))
    subprocess.run(["node", "--input-type=module", "-e", js, str(tmp), str(path)], check=True)

def main(out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    master = solidify(eval_master(PAL, F)); runs = master_runs(master)
    n = 32; cells = level_cells(master, n, runs)
    pal, mats = eval_palette(PAL), eval_materials(PAL)
    grid = lambda c, p=pal: {"n": n, "cells": "".join(c.reshape(-1)), "palette": p, "size": [0.75, 0.95, 0.75]}
    render(grid(cells), out / "1_intact.png")
    cut = cells.copy(); cut[:, n // 2:, :] = "."   # axis 1 is z: remove the half facing the camera
    render(grid(cut), out / "2_cutaway.png")
    burnt, p2, m2 = damage(cells, mats, 0.55, seed=3)
    render(grid(burnt, {**pal, **p2}), out / "3_burnt.png")
    cut2 = burnt.copy(); cut2[:, n // 2:, :] = "."
    render(grid(cut2, {**pal, **p2}), out / "4_burnt_cutaway.png")
    print("cells kept:", {k: int((cells == k).sum()) for k in np.unique(cells) if k != "."}, "| burnt:", {k: int((burnt == k).sum()) for k in np.unique(burnt) if k != "."})

main(sys.argv[1])
