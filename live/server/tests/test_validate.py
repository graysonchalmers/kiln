import unittest

import numpy as np

import _path  # noqa: F401
import config
from silhouette import silhouettes
import test_pipeline as tp
from test_pipeline import FakeLease, FakePool, GOOD
from validate import score, validate


def vol(fill):
    v = np.full((64, 64, 64), ".", dtype="<U1")
    fill(v)
    return v


def codes(v, keys=None):
    return [p["code"] for p in validate(v, keys)]


class ValidateTests(unittest.TestCase):
    def test_clean_prop_has_no_problems(self):
        v = vol(lambda a: a.__setitem__((slice(0, 64), slice(10, 54), slice(10, 54)), "s"))
        self.assertEqual(validate(v, {"s"}), [])

    def test_floating_piece_is_named(self):
        def fill(a):
            a[0:20, 10:40, 10:40] = "s"
            a[50:60, 20:30, 20:30] = "t"
        v = vol(fill)
        p = validate(v)
        self.assertEqual([x["code"] for x in p][:1], ["floating"])
        self.assertIn("'t'", p[0]["text"])
        self.assertIn("top", p[0]["text"])

    def test_short_and_no_ground(self):
        v = vol(lambda a: a.__setitem__((slice(30, 50), slice(10, 50), slice(10, 50)), "s"))
        self.assertIn("short", codes(v))
        self.assertIn("ground", codes(v))

    def test_thin_key_and_missing_key(self):
        def fill(a):
            a[0:64, 10:50, 10:50] = "s"
            a[0:64, 10:50, 52:54] = "p"  # a plank 2 voxels thick
        v = vol(fill)
        self.assertIn("thin", codes(v))
        self.assertIn("key_missing", codes(v, {"s", "p", "q"}))
        self.assertNotIn("key_missing", codes(v, {"s", "p"}))

    def test_score_orders_by_cost(self):
        self.assertGreater(score([{"code": "floating"}]), score([{"code": "thin"}]))


class SilhouetteTests(unittest.TestCase):
    def test_three_views_of_24_rows_and_columns(self):
        v = vol(lambda a: a.__setitem__((slice(0, 64), slice(16, 48), slice(16, 48)), "s"))
        text = silhouettes(v)
        blocks = text.split("\n\n")
        self.assertEqual(len(blocks), 3)
        for b in blocks:
            rows = b.splitlines()[1:]
            self.assertEqual((len(rows), {len(r) for r in rows}), (24, {24}))
        self.assertIn("ssssssss", blocks[0])
        self.assertTrue(blocks[0].splitlines()[1].startswith("......s"))

    def test_nearest_part_shows_its_key(self):
        def fill(a):
            a[0:64, 0:64, 0:64] = "b"
            a[20:40, 50:64, 20:40] = "f"  # a patch on the front (high z)
        front = silhouettes(vol(fill)).split("\n\n")[0]
        self.assertIn("f", front)


class ValidatePipelineTests(unittest.IsolatedAsyncioTestCase):
    """A piece that repair cannot reach (a gap of 0.4) triggers ONE retry whose message names it; the better attempt is delivered."""
    TWO = ('pal({s:"#aa5522",t:"#2255aa"})\nfunction f(u,v,w){const x=u-.5,z=w-.5\n'
           'if(Math.abs(x)<.25&&Math.abs(z)<.25&&v<.15)return "s"\nif(Math.abs(x)<.2&&Math.abs(z)<.2&&v>.55&&v<.8)return "t"\nreturn null}')

    run_it = tp.PipelineTests.run_it

    def setUp(self):
        config.VALIDATE = config.OBSERVE = True

    def tearDown(self):
        config.VALIDATE = config.OBSERVE = config.ASCII = False

    async def test_retry_names_the_problem_and_better_attempt_wins(self):
        first, second = FakeLease([self.TWO]), FakeLease([GOOD])
        c = await self.run_it(FakePool(first, second))
        self.assertEqual(c.types(), ["stage"] * 4 + ["done"])
        self.assertIn("floats", second.notes[0])
        self.assertTrue(first.released_kill)
        checks = c.events[-1]["checks"]
        self.assertEqual((checks["attempts"], checks["retried"], checks["picked"]), (2, True, 2))
        self.assertIn("floating", checks["first"])
        self.assertNotIn("floating", checks["final"])

    async def test_ascii_adds_three_silhouettes_to_the_retry(self):
        config.ASCII = True
        first, second = FakeLease([self.TWO]), FakeLease([GOOD])
        await self.run_it(FakePool(first, second))
        for title in ("FRONT", "SIDE", "TOP"):
            self.assertIn(title, second.notes[0])
        plain = FakeLease([GOOD])
        config.ASCII = False
        await self.run_it(FakePool(FakeLease([self.TWO]), plain))
        self.assertNotIn("FRONT", plain.notes[0])

    async def test_a_worse_retry_is_not_delivered(self):
        three = self.TWO.replace("return null", 'if(Math.abs(x)<.1&&Math.abs(z)<.1&&v>.9)return "t"\nreturn null')  # two floating pieces
        c = await self.run_it(FakePool(FakeLease([self.TWO]), FakeLease([three])))
        self.assertEqual(c.events[-1]["checks"]["picked"], 1)

    async def test_clean_first_attempt_makes_no_retry(self):
        pool = FakePool(FakeLease([GOOD]))
        c = await self.run_it(pool)
        self.assertEqual((pool.acquired, c.events[-1]["checks"]["retried"]), (1, False))


if __name__ == "__main__":
    unittest.main()
