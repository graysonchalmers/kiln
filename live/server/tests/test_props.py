"""Regression tests over a wider set of props (no model needed: each prop is a hand-written shape function).

Golden numbers live in golden_props.json; regenerate them deliberately with `python3 live/tools/update_golden.py`
after a change you meant to make. SKIP_KILN=1 skips the kiln builds (the slow part).
"""
import json
import os
import pathlib
import tempfile
import unittest
import numpy as np
import _path  # noqa: F401
from kiln_runner import build_glb
from ladder import LEVELS, eval_master, eval_palette, level_cells, level_script, master_runs, solidify
from props import PROPS

GOLDEN = json.loads((pathlib.Path(__file__).parent / "golden_props.json").read_text())
KILN_LEVELS = (4, 32)


def analyse(name):
    p = PROPS[name]
    raw = eval_master(p["pal"], p["f"])
    master = solidify(raw)
    runs = master_runs(master)
    cells = {n: level_cells(master, n, runs) for n in LEVELS}
    return p, raw, master, cells


class PropRegressionTests(unittest.TestCase):
    def test_every_prop_has_a_golden_entry_and_vice_versa(self):
        self.assertEqual(set(PROPS), set(GOLDEN))
        self.assertGreaterEqual(len(PROPS), 12)

    def test_props(self):
        for name in sorted(PROPS):
            with self.subTest(prop=name):
                p, raw, master, cells = analyse(name)
                g = GOLDEN[name]
                self.assertTrue((solidify(master) == master).all(), "a solid shape has no sealed voids left")
                self.assertAlmostEqual(float((master != ".").mean()), g["fill"], delta=0.01)
                for n in LEVELS:
                    c = cells[n]
                    present = sorted(set(np.unique(c)) - {"."})
                    self.assertEqual(present, g["levels"][str(n)]["keys"], f"{name} n={n} keys")
                    self.assertAlmostEqual(float((c != ".").mean()), g["levels"][str(n)]["fill"], delta=0.03, msg=f"{name} n={n} fill")
                    if n >= 8:  # thin and detail parts the prop is known for must survive from 8 cells up
                        for k in p.get("must_keep", []):
                            self.assertIn(k, present, f"{name} lost part '{k}' at {n} cells")

    def test_hollow_box_really_was_hollow_before_solidify(self):
        _, raw, master, _ = analyse("hollow_box")
        self.assertLess(float((raw != ".").mean()), 0.4)       # a thin shell
        self.assertGreater(float((master != ".").mean()), 0.5)  # filled: the 0.8 cube is 0.512 of the box

    def test_open_cup_stays_open(self):
        _, raw, master, _ = analyse("cup")
        self.assertTrue((raw == master).all())

    @unittest.skipIf(os.environ.get("SKIP_KILN") == "1", "SKIP_KILN=1")
    def test_kiln_builds_and_triangle_counts(self):
        for name in sorted(PROPS):
            p, _, _, cells = analyse(name)
            for n in KILN_LEVELS:
                with self.subTest(prop=name, level=n), tempfile.TemporaryDirectory() as d:
                    r = build_glb(level_script("prop", p["pal"], cells[n], n, p["size"]), pathlib.Path(d), timeout=20)
                    self.assertTrue(r.ok and r.glb[:4] == b"glTF", r.error)
                    want = GOLDEN[name]["levels"][str(n)]["tris"]
                    self.assertAlmostEqual(r.tris, want, delta=max(8, want * 0.3), msg=f"{name} n={n} tris")


if __name__ == "__main__":
    unittest.main()
