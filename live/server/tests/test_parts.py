import unittest

import numpy as np

import _path  # noqa: F401
import config
import test_pipeline as tp
from ladder import LadderError
from parts import PARTS_TAG, compile_parts, parse_parts, parse_plan_reply
from repair import floating_pieces


def build(text):
    return compile_parts(parse_parts(text))


class ParseTests(unittest.TestCase):
    def test_bad_lines_are_named(self):
        for text, word in (("a | sphere | .5,.5,.5 | .2,.2,.2 | s", "shape"), ("a | box | .5,.5 | .2,.2,.2 | s", "centre"),
                           ("a | box | .5,.5,.5 | .2,.2,.2 | ss", "key"), ("a | box | .5,.5,.5 | .2,.2,.2 | s | nope", "attach"),
                           ("a | box | .5,.5,.5 | 0,.2,.2 | s", "size"), ("a | box", "fields"), ("end", "empty")):
            with self.assertRaises(LadderError, msg=text) as cm:
                parse_parts(text)
            self.assertEqual(cm.exception.code, "bad_plan")
            self.assertIn(word, cm.exception.message)

    def test_plan_reply_waits_for_end_and_skips_function_replies(self):
        head = 'pal({s:"#aa5522"})\nbody | box | .5,.5,.5 | .4,.4,.4 | s\n'
        self.assertIsNone(parse_plan_reply(head))
        pal, body = parse_plan_reply(head + "end\n")
        self.assertEqual(pal, 'pal({s:"#aa5522"})')
        self.assertTrue(body.startswith(PARTS_TAG))
        self.assertIsNotNone(parse_plan_reply(head, final=True))
        self.assertIsNone(parse_plan_reply('pal({s:"#aa5522"})\nfunction f(u,v,w){return "s"}\nend'))


class CompileTests(unittest.TestCase):
    def test_shapes_fill_their_boxes(self):
        for shape in ("box", "cylinder", "cone", "ellipsoid", "capsule", "torus", "cylinder-x", "capsule-z"):
            vol, _ = build(f"a | {shape} | .5,.5,.5 | .6,.5,.6 | s")
            n = int((vol != ".").sum())
            self.assertGreater(n, 800, shape)
            idx = np.argwhere(vol != ".")
            self.assertTrue((idx.min(0) >= 0.2 * 64).all() and (idx.max(0) <= 0.8 * 64).all(), shape)

    def test_attach_snaps_a_far_part_to_the_parent(self):
        loose = "body | box | .5,.3,.5 | .5,.4,.5 | b\nhead | ellipsoid | .5,.85,.5 | .3,.2,.3 | h"
        self.assertEqual(len(floating_pieces(build(loose)[0], 20)[1]), 1)
        vol, rep = build(loose + " | body")
        self.assertEqual(len(floating_pieces(vol, 20)[1]), 0)
        self.assertEqual(rep["snapped"], ["head"])

    def test_ground_and_mirror(self):
        vol, _ = build("leg | capsule | .3,.4,.4 | .12,.3,.12 | l | ground | xz")
        self.assertTrue((vol[0] != ".").any())            # the lowest row is touched
        self.assertTrue((vol == vol[:, :, ::-1]).all() and (vol == vol[:, ::-1, :]).all())  # four legs, mirrored both ways

    def test_thin_parts_get_a_minimum_thickness(self):
        vol, _ = build("plank | box | .5,.5,.5 | .5,.5,.01 | p")
        depth = (vol != ".").any(axis=(0, 2)).sum()
        self.assertGreaterEqual(depth, 4)

    def test_smooth_parts_blend_and_keep_their_keys(self):
        two = "a | ellipsoid | .4,.5,.5 | .4,.4,.4 | x | - | - | smooth\nb | ellipsoid | .62,.5,.5 | .4,.4,.4 | y | - | - | smooth"
        hard = two.replace(" | smooth", "")
        blended, _ = build(two)
        self.assertGreater(int((blended != ".").sum()), int((build(hard)[0] != ".").sum()))   # the blend fills the join
        self.assertEqual(set(np.unique(blended)) - {"."}, {"x", "y"})

    def test_it_is_fast(self):
        import time
        text = "\n".join(f"p{i} | ellipsoid | {.2 + .05 * i},.5,.5 | .3,.3,.3 | s | {'p' + str(i - 1) if i else '-'} | xz | smooth" for i in range(12))
        t = time.time()
        build(text)
        self.assertLess(time.time() - t, 3.0)


PLAN = 'pal({s:"#aa5522",t:"#2255aa"})\nbody | cylinder | .5,.4,.5 | .6,.8,.6 | s | ground\ncap | cone | .5,.9,.5 | .5,.2,.5 | t | body\nend\n'


class PlanPipelineTests(unittest.IsolatedAsyncioTestCase):
    run_it = tp.PipelineTests.run_it

    def setUp(self):
        config.PLAN = True

    def tearDown(self):
        config.PLAN = False

    async def test_part_list_builds_four_levels(self):
        c = await self.run_it(tp.FakePool(tp.FakeLease([PLAN[:30], PLAN[30:]])))
        self.assertEqual(c.types(), ["stage"] * 4 + ["done"])
        self.assertEqual(set(c.events[0]["grid"]["palette"]), {"s", "t"})

    async def test_function_reply_still_works_as_the_escape_hatch(self):
        c = await self.run_it(tp.FakePool(tp.FakeLease([tp.GOOD])))
        self.assertEqual(c.types(), ["stage"] * 4 + ["done"])

    async def test_bad_plan_retries_with_the_part_list_hint(self):
        second = tp.FakeLease([PLAN])
        c = await self.run_it(tp.FakePool(tp.FakeLease(['pal({s:"#aa5522"})\nbody | sphere | .5,.5,.5 | .5,.5,.5 | s\nend']), second))
        self.assertEqual(c.types(), ["stage"] * 4 + ["done"])
        self.assertIn("shape", second.notes[0])
        self.assertIn("part list", second.notes[0])


if __name__ == "__main__":
    unittest.main()
