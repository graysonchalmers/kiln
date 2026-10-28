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
    def __init__(self, chunks, followup_chunks=()):
        self.chunks, self.followup_chunks = chunks, followup_chunks
        self.released_kill = None
        self.followups = []
        self.gate = None

    async def generate(self, prompt, size):
        self.prompt, self.size = prompt, size
        for c in self.chunks:
            if c is None:
                await self.gate.wait()
            else:
                yield c

    async def followup(self, text):
        self.followups.append(text)
        for c in self.followup_chunks:
            yield c

    async def release(self, kill=False):
        self.released_kill = kill


class FakePool:
    def __init__(self, lease=None, exc=None):
        self.lease, self.exc, self.acquired = lease, exc, 0

    async def acquire(self):
        self.acquired += 1
        if self.exc:
            raise self.exc
        return self.lease


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

    async def test_emits_five_levels_in_order(self):
        lease = FakeLease([GOOD])
        c = await self.run_it(FakePool(lease))
        stages = [e for e in c.events if e["type"] == "stage"]
        self.assertEqual([e["index"] for e in stages], [0, 1, 2, 3, 4])
        self.assertEqual([e["level"] for e in stages], list(LEVELS))
        self.assertEqual(c.types(), ["stage"] * 5 + ["done"])
        self.assertEqual(c.events[-1]["stages"], 5)
        self.assertTrue(all(b.startswith(b"glTF") for b in c.blobs[:5]))
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
        self.assertEqual([e["level"] for e in stages], [0, 4, 16, 32])
        self.assertEqual([e["index"] for e in stages], [0, 1, 2, 3])
        self.assertEqual(c.events[-1], {"type": "done", "stages": 4})

    async def test_eval_error_retries_once_with_error_text(self):
        lease = FakeLease([BAD_F], followup_chunks=[GOOD])
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.types()[-1], "done")
        self.assertEqual(len(lease.followups), 1)
        self.assertIn("boom", lease.followups[0])

    async def test_retry_also_fails_emits_the_error_code(self):
        lease = FakeLease([BAD_F], followup_chunks=[BAD_F])
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.types(), ["error"])
        self.assertEqual(c.events[0]["code"], "eval_error")

    async def test_no_function_in_reply_emits_bad_reply(self):
        lease = FakeLease(["Sorry, I cannot do that."], followup_chunks=["still no"])
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.events[0]["code"], "bad_reply")
        self.assertIsNotNone(lease.released_kill)

    async def test_pool_unavailable_emits_generator_unavailable(self):
        c = await self.run_it(FakePool(exc=PoolUnavailable("quota")))
        self.assertEqual(c.events[0]["code"], "generator_unavailable")
        self.assertIn("quota", c.events[0]["message"])

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
