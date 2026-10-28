import asyncio
import math
import pathlib
import tempfile
import unittest
import _path  # noqa: F401
from kiln_runner import BuildResult
from ladder import LEVELS
from pipeline import run_request
from pool import PoolUnavailable

PAL = 'pal({s:"#aa5522"})'
GOOD = PAL + '\nfunction f(u,v,w){return Math.hypot(u-.5,v-.5,w-.5)<.5?"s":null}'
BAD_F = PAL + '\nfunction f(u,v,w){throw new Error("boom")}'
SIZE = (1.0, 2.0, 0.8)


def ok_build(script, workdir):
    return BuildResult(True, b"glTF" + script[:20].encode(), 100, None, 0.01)


def reject8_build(script, workdir):
    ok = "[8, 8, 8]" not in script
    return BuildResult(ok, b"glTF" + script[:20].encode() if ok else None, 100 if ok else None,
                       None if ok else "kiln: bad level", 0.01)


class FakeLease:
    def __init__(self, chunks):
        self.chunks = chunks
        self.released_kill = None
        self.notes = []
        self.gate = None

    async def generate(self, prompt, size, note=""):
        self.prompt, self.size = prompt, size
        self.notes.append(note)
        for c in self.chunks:
            if c is None:
                await self.gate.wait()
            else:
                yield c

    async def followup(self, text):  # the real process is dead after the first reply is read early: never usable
        raise ConnectionResetError("Connection lost")
        yield

    async def release(self, kill=False):
        self.released_kill = kill


class FakePool:
    """acquire() hands out the leases in order (the last one repeats); `exc` is raised from the exc_at-th acquire on."""
    def __init__(self, *leases, exc=None, exc_at=1):
        self.leases, self.exc, self.exc_at, self.acquired = leases, exc, exc_at, 0

    async def acquire(self):
        self.acquired += 1
        if self.exc and self.acquired >= self.exc_at:
            raise self.exc
        return self.leases[min(self.acquired, len(self.leases)) - 1]


class Collector:
    def __init__(self):
        self.events, self.blobs = [], []

    async def __call__(self, ev, blob=None):
        self.events.append(ev)
        self.blobs.append(blob)

    def types(self):
        return [e["type"] for e in self.events]


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    async def run_it(self, pool, prompt="barrel", size=SIZE, build=ok_build):
        c = Collector()
        with tempfile.TemporaryDirectory() as d:
            await asyncio.wait_for(run_request(pool, prompt, size, c, pathlib.Path(d), build=build), 30)
        return c

    async def test_mat_tag_reaches_the_client_but_not_kiln(self):
        scripts = []

        def spy_build(script, workdir):
            scripts.append(script)
            return ok_build(script, workdir)
        good = 'pal({s:{color:"#aa5522",mat:"wood"}})\nfunction f(u,v,w){return "s"}'
        c = await self.run_it(FakePool(FakeLease([good])), build=spy_build)
        self.assertEqual([e["grid"]["materials"] for e in c.events if e["type"] == "stage"], [{"s": "wood"}] * 4)
        self.assertEqual(len(scripts), 4)
        for sc in scripts:  # kiln's pal() rejects unknown options: the mat tag must be stripped from its script
            self.assertNotIn('"mat"', sc)

    async def test_emits_four_levels_in_order(self):
        lease = FakeLease([GOOD])
        c = await self.run_it(FakePool(lease))
        stages = [e for e in c.events if e["type"] == "stage"]
        self.assertEqual([e["index"] for e in stages], [0, 1, 2, 3])
        self.assertEqual([e["level"] for e in stages], list(LEVELS))
        self.assertEqual(c.types(), ["stage"] * 4 + ["done"])
        for e in stages:  # each level also carries its voxel grid for the client to draw brick by brick
            self.assertEqual(e["grid"]["n"], e["level"])
            self.assertEqual(len(e["grid"]["cells"]), e["level"] ** 3)
            self.assertEqual(e["grid"]["palette"], {"s": "#aa5522"})
            self.assertEqual(e["grid"]["materials"], {"s": "wood"})  # tag per palette key, next to the palette
        for e in stages:  # timing breakdown: the function arrives before any level can land
            self.assertGreaterEqual(e["t_function"], 0)
            self.assertLessEqual(e["t_function"], e["t_ready"])
        self.assertEqual(c.events[-1]["stages"], 4)
        self.assertTrue(all(b.startswith(b"glTF") for b in c.blobs[:4]))
        self.assertTrue(lease.released_kill)

    async def test_stops_reading_once_the_function_is_complete(self):
        lease = FakeLease([GOOD[:30], GOOD[30:], None])  # stream would hang after the full reply
        lease.gate = asyncio.Event()
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.types()[-1], "done")

    async def test_bad_prompt_and_size_rejected_without_model_call(self):
        cases = [("", SIZE, "bad_prompt"), ("   ", SIZE, "bad_prompt"), ("x" * 501, SIZE, "bad_prompt"),
                 ("ok", (0, 1, 1), "bad_size"), ("ok", (-1, 1, 1), "bad_size"),
                 ("ok", (math.nan, 1, 1), "bad_size"), ("ok", (1, 20.5, 1), "bad_size"), ("ok", (1, 1), "bad_size")]
        for prompt, size, code in cases:
            pool = FakePool(FakeLease([GOOD]))
            c = await self.run_it(pool, prompt, size)
            self.assertEqual(c.types(), ["error"], (prompt[:5], size))
            self.assertEqual(c.events[0]["code"], code)
            self.assertEqual(pool.acquired, 0)

    async def test_failed_level_is_skipped_and_indices_stay_contiguous(self):
        c = await self.run_it(FakePool(FakeLease([GOOD])), build=reject8_build)
        stages = [e for e in c.events if e["type"] == "stage"]
        self.assertEqual([e["level"] for e in stages], [4, 16, 32])
        self.assertEqual([e["index"] for e in stages], [0, 1, 2])
        self.assertEqual(c.events[-1], {"type": "done", "stages": 3})

    async def test_eval_error_retries_once_on_a_fresh_lease_with_the_error_text(self):
        first, second = FakeLease([BAD_F]), FakeLease([GOOD])
        pool = FakePool(first, second)
        c = await self.run_it(pool)
        self.assertEqual(c.types()[-1], "done")
        self.assertEqual(pool.acquired, 2)
        self.assertTrue(first.released_kill)                      # its process is dead after the early read
        self.assertEqual(second.prompt, "barrel")                # the retry carries the original request
        self.assertIn("boom", second.notes[0])                   # and says what failed

    async def test_retry_also_fails_emits_the_real_error_code_and_message(self):
        c = await self.run_it(FakePool(FakeLease([BAD_F]), FakeLease([BAD_F])))
        self.assertEqual(c.types(), ["error"])
        self.assertEqual(c.events[0]["code"], "eval_error")
        self.assertIn("boom", c.events[0]["message"])            # not "ConnectionResetError: Connection lost"

    async def test_no_function_in_reply_emits_bad_reply(self):
        first = FakeLease(["Sorry, I cannot do that."])
        c = await self.run_it(FakePool(first, FakeLease(["still no"])))
        self.assertEqual(c.events[0]["code"], "bad_reply")
        self.assertIsNotNone(first.released_kill)

    async def test_retry_with_the_real_pool_and_a_process_that_dies_when_its_reply_is_cut_short(self):
        import sys
        from pool import Pool
        fake = [sys.executable, str(pathlib.Path(__file__).parent / "fake_claude_retry.py")]
        pool = Pool(size=2, system_prompt_path=__file__, command=fake)
        await pool.start()
        try:
            c = await self.run_it(pool)
        finally:
            await pool.close()
        self.assertEqual(c.types()[-1], "done", c.events[-1])
        self.assertEqual(sum(1 for e in c.events if e["type"] == "stage"), 4)

    async def test_pool_unavailable_emits_generator_unavailable(self):
        c = await self.run_it(FakePool(exc=PoolUnavailable("quota")))
        self.assertEqual(c.events[0]["code"], "generator_unavailable")
        self.assertIn("quota", c.events[0]["message"])

    async def test_pool_unavailable_for_the_retry_emits_generator_unavailable(self):
        c = await self.run_it(FakePool(FakeLease([BAD_F]), exc=PoolUnavailable("quota"), exc_at=2))
        self.assertEqual(c.events[0]["code"], "generator_unavailable")

    async def test_cancel_kills_lease(self):
        lease = FakeLease(["pal({s:", None])
        lease.gate = asyncio.Event()
        with tempfile.TemporaryDirectory() as d:
            task = asyncio.create_task(run_request(FakePool(lease), "barrel", SIZE, Collector(), pathlib.Path(d), build=ok_build))
            await asyncio.sleep(0.3)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        self.assertTrue(lease.released_kill)


if __name__ == "__main__":
    unittest.main()
