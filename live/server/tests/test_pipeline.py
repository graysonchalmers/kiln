import asyncio
import math
import pathlib
import tempfile
import unittest
import _path  # noqa: F401
from kiln_runner import BuildResult
from pipeline import run_request
from pool import PoolUnavailable

SEP = "\n//---STAGE---\n"
OK1 = 'pal({r:"#a00"})\nmodel("a", voxfn([2,2,2], (x,y,z)=>"r", {size:0.1}))'
OK2 = 'pal({r:"#a00"})\nmodel("a", voxfn([4,4,4], (x,y,z)=>"r", {size:0.05}))'
BAD = 'pal({r:"#a00"})\nmodel("a", BAD(1))'
SIZE = (1.0, 2.0, 0.8)


def fake_build(script, workdir):
    ok = "BAD" not in script
    return BuildResult(ok, b"glTF" + script.encode() if ok else None, len(script) if ok else None,
                       None if ok else "ReferenceError: BAD is not defined", 0.01)


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
    async def run_it(self, pool, prompt="barrel", size=SIZE):
        c = Collector()
        with tempfile.TemporaryDirectory() as d:
            await run_request(pool, prompt, size, c, pathlib.Path(d), build=fake_build)
        return c

    async def test_emits_stage_per_complete_stage_before_stream_ends(self):
        lease = FakeLease([OK1 + SEP, None, OK2])
        lease.gate = asyncio.Event()
        c = Collector()
        with tempfile.TemporaryDirectory() as d:
            task = asyncio.create_task(run_request(FakePool(lease), "barrel", SIZE, c, pathlib.Path(d), build=fake_build))
            for _ in range(100):
                if "stage" in c.types():
                    break
                await asyncio.sleep(0.02)
            self.assertIn("stage", c.types())
            self.assertFalse(task.done())
            lease.gate.set()
            await asyncio.wait_for(task, 5)
        self.assertEqual(c.types(), ["stage", "stage", "done"])
        self.assertEqual([e["index"] for e in c.events if e["type"] == "stage"], [0, 1])
        self.assertEqual(c.events[-1]["stages"], 2)
        self.assertTrue(c.blobs[0].startswith(b"glTF"))

    async def test_bad_prompt_and_size_rejected_without_model_call(self):
        cases = [("", SIZE, "bad_prompt"), ("   ", SIZE, "bad_prompt"), ("x" * 501, SIZE, "bad_prompt"),
                 ("ok", (0, 1, 1), "bad_size"), ("ok", (-1, 1, 1), "bad_size"),
                 ("ok", (math.nan, 1, 1), "bad_size"), ("ok", (1, 20.5, 1), "bad_size"), ("ok", (1, 1), "bad_size")]
        for prompt, size, code in cases:
            pool = FakePool(FakeLease([OK1]))
            c = await self.run_it(pool, prompt, size)
            self.assertEqual(c.types(), ["error"], (prompt[:5], size))
            self.assertEqual(c.events[0]["code"], code)
            self.assertEqual(pool.acquired, 0)

    async def test_later_failed_stage_is_skipped_without_error(self):
        lease = FakeLease([OK1 + SEP + BAD + SEP + OK2])
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.types(), ["stage", "stage", "done"])
        self.assertEqual(c.events[-1]["stages"], 2)
        self.assertEqual(lease.followups, [])

    async def test_first_stage_failure_retries_once_with_error_text(self):
        lease = FakeLease([BAD], followup_chunks=[OK1])
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.types(), ["stage", "done"])
        self.assertEqual(len(lease.followups), 1)
        self.assertIn("ReferenceError", lease.followups[0])

    async def test_retry_also_fails_emits_build_failed(self):
        lease = FakeLease([BAD], followup_chunks=[BAD])
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.types(), ["error"])
        self.assertEqual(c.events[0]["code"], "build_failed")

    async def test_no_stage_output_emits_no_stages_error(self):
        lease = FakeLease(["Sorry, I cannot do that."])
        c = await self.run_it(FakePool(lease))
        self.assertEqual(c.events[0]["code"], "no_stages")
        self.assertTrue(lease.released_kill is not None)

    async def test_pool_unavailable_emits_generator_unavailable(self):
        c = await self.run_it(FakePool(exc=PoolUnavailable("quota")))
        self.assertEqual(c.events[0]["code"], "generator_unavailable")
        self.assertIn("quota", c.events[0]["message"])

    async def test_cancel_kills_lease(self):
        lease = FakeLease([OK1 + SEP, None])
        lease.gate = asyncio.Event()
        with tempfile.TemporaryDirectory() as d:
            task = asyncio.create_task(run_request(FakePool(lease), "barrel", SIZE, Collector(), pathlib.Path(d), build=fake_build))
            await asyncio.sleep(0.3)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        self.assertTrue(lease.released_kill)


if __name__ == "__main__":
    unittest.main()
