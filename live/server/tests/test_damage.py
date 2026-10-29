import asyncio
import os
import pathlib
import tempfile
import unittest
import numpy as np
import _path  # noqa: F401
from damage import damage, settle
from ladder import AIR, eval_master, level_cells, solidify

HOLLOW = ('function f(u,v,w){if(u<.1||u>.9||v<.1||v>.9||w<.1||w>.9)return null;'
          'const e=Math.min(u-.1,.9-u,v-.1,.9-v,w-.1,.9-w);return e<.1?"s":"_"}')   # sealed shell with deliberate air inside
PAL = 'pal({s:"#8a6a3a"})'


def grid():
    n = 16
    c = np.full((n, n, n), ".")
    c[:, :, :] = "s"                                   # skin everywhere
    c[:, 7:9, 7:9] = "h"                               # a structural post through the middle
    return c


MATS = {"s": "wood", "h": "structural"}


class AirTests(unittest.TestCase):
    def test_air_inside_a_sealed_shell_stays_hollow(self):
        m = solidify(eval_master(PAL, HOLLOW, n=16))
        self.assertFalse((m == AIR).any(), "AIR comes back as plain empty")
        self.assertEqual(m[8, 8, 8], ".")               # the centre is not filled
        self.assertEqual(m[8, 8, 2], "s")   # the wall (0.1 to 0.2 of the cube)

    def test_plain_void_is_still_filled(self):
        sealed = HOLLOW.replace('"_"', "null")
        m = solidify(eval_master(PAL, sealed, n=16))
        self.assertEqual(m[8, 8, 8], "s")

    def test_hollow_survives_pooling(self):
        m = solidify(eval_master(PAL, HOLLOW, n=32))
        cells = level_cells(m, 16)
        self.assertEqual(cells[8, 8, 8], ".")
        self.assertNotEqual(cells[2, 8, 8], ".")


class SettleTests(unittest.TestCase):
    def test_floating_slab_lands_on_the_base_and_a_loose_post_reaches_the_ground(self):
        c = np.full((8, 8, 8), ".")
        c[0:2, 3:5, 3:5] = "a"      # base on the ground
        c[5, 3:5, 3:5] = "b"        # slab hanging in the air above it
        c[6:8, 0, 0] = "c"          # post off to the side
        o = settle(c)
        self.assertEqual(sorted(set(int(y) for y in np.argwhere(o == "b")[:, 0])), [2])
        self.assertEqual(sorted(set(int(y) for y in np.argwhere(o == "c")[:, 0])), [0, 1])
        self.assertEqual(int((o == "a").sum()), int((c == "a").sum()))
        self.assertEqual(int((o != ".").sum()), int((c != ".").sum()), "nothing is lost or duplicated")

    def test_supported_parts_stay_and_stacks_fall_together(self):
        c = np.full((8, 8, 8), ".")
        c[0:3, 1, 1] = "a"          # a standing post: untouched
        c[4:6, 5, 5] = "b"          # a two-cell stack in the air: falls as one piece
        o = settle(c)
        self.assertTrue((o[0:3, 1, 1] == "a").all())
        self.assertTrue((o[0:2, 5, 5] == "b").all() and o[2, 5, 5] == ".")

    def test_ground_is_the_lowest_occupied_layer_not_y_zero(self):
        c = np.full((8, 8, 8), ".")
        c[2:4, 3, 3] = "a"          # a prop that sits on layer 2
        self.assertTrue((settle(c, y0=2) == c).all())

    def test_a_snapped_ring_lands_on_what_is_left_and_damage_runs_it(self):
        c = np.full((16, 16, 16), ".")
        c[0:8, 4:12, 4:12] = "s"                 # a solid body
        c[11, 3:13, 3:13] = "h"                  # a ring-ish slab above it, not touching
        MAT = {"s": "wood", "h": "structural"}
        out, _, _ = damage(c, MAT, 0.3, seed=1)
        self.assertEqual(sorted(set(int(y) for y in np.argwhere(out == "h")[:, 0]))[0] > 0, True)
        ys = [int(y) for y in np.argwhere(out == "h")[:, 0]]
        self.assertTrue(max(ys) < 11, "the slab fell")
        no_fall, _, _ = damage(c, MAT, 0.3, seed=1, fall=False)
        self.assertEqual(max(int(y) for y in np.argwhere(no_fall == "h")[:, 0]), 11)


class PaletteAirTests(unittest.TestCase):
    def test_air_key_is_never_a_palette_colour(self):
        from ladder import eval_materials, eval_palette
        pal = 'pal({s:"#aa5522",_:{color:"#888888",mat:"metal"}})'
        self.assertEqual(eval_palette(pal), {"s": "#aa5522"})
        self.assertEqual(eval_materials(pal), {"s": "wood"})


class DamageTests(unittest.TestCase):
    def test_zero_amount_is_unchanged_and_deterministic(self):
        c = grid()
        out, pal, mats = damage(c, MATS, 0.0, seed=1)
        self.assertTrue((out == c).all() and not pal and not mats)
        a, *_ = damage(c, MATS, 0.5, seed=7)
        b, *_ = damage(c, MATS, 0.5, seed=7)
        d, *_ = damage(c, MATS, 0.5, seed=8)
        self.assertTrue((a == b).all())
        self.assertFalse((a == d).all())

    def test_more_damage_removes_more_and_structure_outlasts_skin(self):
        c = grid()
        lost = []
        for amount in (0.2, 0.5, 0.8):
            out, _, _ = damage(c, MATS, amount, seed=2)
            lost.append(int((out == ".").sum()))
        self.assertEqual(lost, sorted(lost))
        out, _, _ = damage(c, MATS, 0.6, seed=2)
        skin_left = (c == "s") & (out != ".")
        post_left = (c == "h") & (out == "h")
        self.assertGreater(post_left.sum() / (c == "h").sum(), skin_left.sum() / (c == "s").sum())

    def test_burn_chars_and_adds_palette_keys_break_does_not(self):
        c = grid()
        out, pal, mats = damage(c, MATS, 0.5, seed=3, mode="burn")
        char = [k for k, t in mats.items() if t == "charred"]
        ember = [k for k, t in mats.items() if t == "emissive"]
        self.assertEqual((len(char), len(ember)), (1, 1))
        self.assertIn(char[0], set(out.reshape(-1)))
        self.assertTrue(set(pal) == {char[0], ember[0]} and not ({char[0], ember[0]} & {"s", "h"}), "free keys")
        for k in (char[0], ember[0]):
            self.assertRegex(k, r"^[A-Za-z0-9_]$", "kiln's pal() accepts only letters, digits and _")
        out2, pal2, _ = damage(c, MATS, 0.5, seed=3, mode="break")
        self.assertEqual(pal2, {})
        self.assertFalse({"Z", "Y"} & set(out2.reshape(-1)))

    def test_charred_keys_avoid_keys_the_grid_already_uses(self):
        c = grid()
        c[0, 0, 0] = "Z"
        _, pal, _ = damage(c, {**MATS, "Y": "metal"}, 0.5, seed=3)
        self.assertFalse({"Z", "Y"} & set(pal))


@unittest.skipIf(os.environ.get("SKIP_KILN"), "SKIP_KILN set")
class KilnDamageTests(unittest.TestCase):
    """The damaged grid must really build in kiln (a fake build once hid that kiln refuses '~' as a palette key)."""
    def test_burn_break_and_every_level_build_a_glb(self):
        from pipeline import run_damage
        pal = {"s": "#9c6a4d", "h": "#3a3a3a"}
        mats = {"s": "wood", "h": "structural"}
        for n in (4, 16):
            c = np.full((n, n, n), ".")
            c[:, 1:n - 1, 1:n - 1] = "s"
            c[:, n // 2 - 1:n // 2 + 1, n // 2 - 1:n // 2 + 1] = "h"
            grid = {"n": n, "cells": "".join(c.reshape(-1)), "palette": pal, "materials": mats}
            for mode in ("burn", "break"):
                ev = []

                async def emit(e, b=None):
                    ev.append((e, b))
                with tempfile.TemporaryDirectory() as d:
                    asyncio.run(run_damage({"type": "damage", "grid": grid, "amount": 0.3, "mode": mode, "glb": True,
                                            "size": [1, 1, 1]}, emit, pathlib.Path(d)))
                self.assertEqual(ev[0][0]["type"], "damaged", (n, mode, ev[0][0]))
                self.assertEqual(ev[0][1][:4], b"glTF")


if __name__ == "__main__":
    unittest.main()
