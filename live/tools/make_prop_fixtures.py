#!/usr/bin/env python3
"""Write every prop's 8- and 32-cell grids (plus a manifest) for the Godot gallery: live/client/tests/props/"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "server"))
from ladder import eval_master, eval_materials, eval_palette, level_cells, master_runs, solidify  # noqa: E402
from damage import damage  # noqa: E402
from props import PROPS, STRUCTURAL  # noqa: E402

OUT = HERE.parent / "client" / "tests" / "props"
OUT.mkdir(parents=True, exist_ok=True)
manifest = []
for name, p in sorted(PROPS.items()):
    master = solidify(eval_master(p["pal"], p["f"]))
    runs = master_runs(master)
    palette = eval_palette(p["pal"])
    materials = eval_materials(p["pal"])
    for n in (8, 32):
        cells = level_cells(master, n, runs)
        if n == 32:  # burnt set for the damage gallery: structural keys marked, fire from the top, 50 percent
            mats = {k: ("structural" if k in STRUCTURAL.get(name, []) else t) for k, t in materials.items()}
            burnt, pal2, mats2 = damage(cells, mats, 0.5, seed=sum(map(ord, name)))
            (OUT / f"{name}_32_burnt.json").write_text(json.dumps(
                {"n": 32, "cells": "".join(burnt.reshape(-1)), "palette": {**palette, **pal2}, "materials": {**mats, **mats2}}))
        (OUT / f"{name}_{n}.json").write_text(json.dumps({"n": n, "cells": "".join(cells.reshape(-1)), "palette": palette, "materials": materials}))
    manifest.append({"name": name, "size": list(p["size"])})
(OUT / "props.json").write_text(json.dumps(manifest))
print(len(manifest), "props written to", OUT)
