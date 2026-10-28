import unittest
import numpy as np
import _path  # noqa: F401
from damage import CHAR, EMBER, damage
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
        self.assertIn(CHAR, set(out.reshape(-1)))
        self.assertEqual(mats[CHAR], "charred")
        self.assertEqual(mats[EMBER], "emissive")
        out2, pal2, _ = damage(c, MATS, 0.5, seed=3, mode="break")
        self.assertNotIn(CHAR, set(out2.reshape(-1)))
        self.assertEqual(pal2, {})


if __name__ == "__main__":
    unittest.main()
