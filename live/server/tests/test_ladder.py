import pathlib
import tempfile
import time
import unittest
import numpy as np
import _path  # noqa: F401
from kiln_runner import build_glb
from ladder import LEVELS, LadderError, eval_master, level_cells, level_script, parse_reply

PAL = 'pal({s:"#aa5522",p:"#222222",g:"#88ccff",h:"#444444"})'
SPHERE = 'function f(u,v,w){return Math.hypot(u-.5,v-.5,w-.5)<.5?"s":null}'
POLE = 'function f(u,v,w){return Math.abs(u-.5)<.02&&Math.abs(w-.5)<.02?"p":null}'
# body with a thin inset window ("g") and a thin hoop ("h")
WINDOW = ('function f(u,v,w){if(u<.1||u>.9||w<.1||w>.9||v>.95)return null;'
          'if(w>.86&&Math.abs(u-.5)<.04&&Math.abs(v-.5)<.04)return "g";'
          'if(Math.abs(v-.2)<.012)return "h";return "s"}')
CUBE = 'function f(u,v,w){return "s"}'


def keys_present(cells):
    return set(np.unique(cells)) - {"."}


class ParseTests(unittest.TestCase):
    def test_parse_with_fences_and_prose(self):
        text = "Here:\n```js\n" + PAL + "\n" + SPHERE + "\n```\nDone"
        pal, f = parse_reply(text)
        self.assertTrue(pal.startswith("pal(") and pal.endswith(")"))
        self.assertTrue(f.startswith("function f") and f.endswith("}"))

    def test_incomplete_or_missing_f_raises_bad_reply(self):
        for text in (PAL, PAL + "\nfunction f(u,v,w){return 1", "no code here", SPHERE):
            with self.assertRaises(LadderError) as c:
                parse_reply(text)
            self.assertEqual(c.exception.code, "bad_reply")


class EvalTests(unittest.TestCase):
    def test_sphere_volume_fraction(self):
        m = eval_master(PAL, SPHERE, n=32)
        self.assertEqual(m.shape, (32, 32, 32))
        self.assertAlmostEqual(float((m != ".").mean()), 0.5236, delta=0.03)

    def test_infinite_loop_times_out(self):
        t = time.time()
        with self.assertRaises(LadderError) as c:
            eval_master(PAL, 'function f(u,v,w){while(true){}}', n=8, timeout=2.0)
        self.assertEqual(c.exception.code, "eval_error")
        self.assertLess(time.time() - t, 8)

    def test_throwing_f_raises_eval_error(self):
        with self.assertRaises(LadderError) as c:
            eval_master(PAL, 'function f(u,v,w){throw new Error("boom")}', n=8)
        self.assertEqual(c.exception.code, "eval_error")
        self.assertIn("boom", c.exception.message)

    def test_multichar_and_garbage_returns_are_empty_and_empty_volume_errors(self):
        with self.assertRaises(LadderError) as c:
            eval_master(PAL, 'function f(u,v,w){return "ab"}', n=8)
        self.assertEqual(c.exception.code, "empty")

    def test_no_access_to_node_apis(self):
        with self.assertRaises(LadderError):
            eval_master(PAL, 'function f(u,v,w){return require("fs")?"s":null}', n=8)


class LevelTests(unittest.TestCase):
    def test_levels_constant(self):
        self.assertEqual(LEVELS, (4, 8, 16, 32))  # the client draws the block itself

    def test_cube_is_full_at_every_level(self):
        m = eval_master(PAL, CUBE, n=64)
        for n in (4, 8, 16, 32):
            cells = level_cells(m, n)
            self.assertEqual(cells.shape, (n, n, n))
            self.assertFalse((cells == ".").any(), n)

    def test_thin_pole_survives_every_level(self):
        m = eval_master(PAL, POLE, n=64)
        for n in (4, 8, 16, 32):
            cells = level_cells(m, n)
            self.assertIn("p", keys_present(cells), n)
            # a single column: it never spreads wider than 1 cell + 1 neighbour
            xs = np.where((cells == "p").any(axis=(0, 1)))[0]
            self.assertLessEqual(len(xs), 2, n)

    def test_thin_window_and_hoop_keep_their_keys_at_every_level(self):
        m = eval_master(PAL, WINDOW, n=64)
        for n in (4, 8, 16, 32):
            present = keys_present(level_cells(m, n))
            # the window is smaller than a 4-cell cell, so it may only appear from 8 cells up; the hoop always shows
            want = {"h", "s"} if n == 4 else {"g", "h", "s"}
            self.assertTrue(want <= present, (n, present))

    def test_sphere_silhouette_does_not_balloon(self):
        m = eval_master(PAL, SPHERE, n=64)
        fine = float((m != ".").mean())
        for n in (8, 16, 32):
            frac = float((level_cells(m, n) != ".").mean())
            self.assertLess(abs(frac - fine), 0.12, (n, frac, fine))


class BuildTests(unittest.TestCase):
    def build(self, script):
        with tempfile.TemporaryDirectory() as d:
            return build_glb(script, pathlib.Path(d), timeout=15)

    def test_levels_build_in_kiln(self):
        m = eval_master(PAL, SPHERE, n=64)
        size = (1.0, 2.0, 0.8)
        for n in (4, 16, 32):
            r = self.build(level_script("prop", PAL, level_cells(m, n), n, size))
            self.assertTrue(r.ok and r.tris > 0, (n, r.error))


if __name__ == "__main__":
    unittest.main()
