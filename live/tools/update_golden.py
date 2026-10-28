#!/usr/bin/env python3
"""Regenerate live/server/tests/golden_props.json from the current ladder code. Run it only after a change you meant
to make to the ladder, then read the diff: those numbers are what the regression test holds the code to."""
import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "server"))
from kiln_runner import build_glb  # noqa: E402
from ladder import LEVELS, eval_master, level_cells, level_script, master_runs, solidify  # noqa: E402
from props import PROPS  # noqa: E402

KILN_LEVELS = (4, 32)
out = {}
for name, p in sorted(PROPS.items()):
    master = solidify(eval_master(p["pal"], p["f"]))
    runs = master_runs(master)
    entry = {"fill": round(float((master != ".").mean()), 4), "levels": {}}
    for n in LEVELS:
        cells = level_cells(master, n, runs)
        e = {"keys": sorted(set(cells.reshape(-1)) - {"."}), "fill": round(float((cells != ".").mean()), 4)}
        if n in KILN_LEVELS:
            with tempfile.TemporaryDirectory() as d:
                r = build_glb(level_script("prop", p["pal"], cells, n, p["size"]), pathlib.Path(d), timeout=30)
            assert r.ok, (name, n, r.error)
            e["tris"] = r.tris
        entry["levels"][str(n)] = e
    out[name] = entry
    print(name, entry["fill"], {n: (v["fill"], v.get("tris")) for n, v in entry["levels"].items()})
(HERE.parent / "server" / "tests" / "golden_props.json").write_text(json.dumps(out, indent=1, sort_keys=True))
