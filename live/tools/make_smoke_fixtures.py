#!/usr/bin/env python3
"""Write the barrel ladder levels (4, 8, 16, 32 cells) as GLB + JSON grid for the Godot smoke test: live/client/tests/ladder_<n>.glb/.json"""
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "server"))
from kiln_runner import build_glb  # noqa: E402
import json  # noqa: E402
from ladder import LEVELS, eval_master, eval_palette, level_cells, level_script, master_runs, solidify  # noqa: E402

PAL = 'pal({w:"#9c6a4d",h:"#3a3a3a",t:"#c9a37a"})'
F = ('function f(u,v,w){const x=u-.5,z=w-.5,r=Math.hypot(x,z),bulge=.4+.1*Math.sin(Math.PI*v)\n'
     'if(r>bulge)return null\nif(v>.94||v<.03)return "t"\n'
     'if(Math.abs(v-.2)<.04||Math.abs(v-.8)<.04)return "h"\nreturn "w"}')
SIZE = (1.0, 1.4, 1.0)
OUT = HERE.parent / "client" / "tests"

master = solidify(eval_master(PAL, F))
runs = master_runs(master)
palette = eval_palette(PAL)
for n in LEVELS:
    with tempfile.TemporaryDirectory() as d:
        r = build_glb(level_script("barrel", PAL, level_cells(master, n, runs), n, SIZE), pathlib.Path(d))
    assert r.ok, r.error
    cells = level_cells(master, n, runs)
    (OUT / f"ladder_{n}.glb").write_bytes(r.glb)
    (OUT / f"ladder_{n}.json").write_text(json.dumps({"n": n, "cells": "".join(cells.reshape(-1)), "palette": palette}))
    print(n, r.tris, "tris", len(r.glb), "bytes")
