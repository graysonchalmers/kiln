import asyncio
import os
import pathlib
import sys
import time
import unittest
import _path  # noqa: F401
from pool import CLAUDE_ARGS, Pool, PoolUnavailable

FAKE = [sys.executable, str(pathlib.Path(__file__).parent / "fake_claude.py")]
SIZE = (1.0, 2.0, 0.8)


def make_pool(**kw):
    return Pool(size=2, system_prompt_path=str(pathlib.Path(__file__)), command=kw.pop("command", FAKE), **kw)


class PoolTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.pool = make_pool()
        await self.pool.start()
        self.assertTrue(await self.pool.wait_ready(2, 5))

    async def asyncTearDown(self):
        await self.pool.close()

    async def test_streams_deltas_in_order(self):
        lease = await self.pool.acquire()
        text = "".join([d async for d in lease.generate("barrel", SIZE)])
        await lease.release()
        self.assertEqual(text.count("//---STAGE---"), 1)
        self.assertTrue(text.startswith("pal("))

    async def test_release_prespawns_replacement(self):
        lease = await self.pool.acquire()
        await lease.release()
        self.assertTrue(await self.pool.wait_ready(2, 2))
        self.assertEqual(len(self.pool.respawn_seconds), 3)

    async def test_third_acquire_waits_then_completes(self):
        async def one():
            lease = await self.pool.acquire()
            text = "".join([d async for d in lease.generate("lamp", SIZE)])
            await lease.release()
            return text
        results = await asyncio.wait_for(asyncio.gather(one(), one(), one()), 20)
        self.assertEqual(len(results), 3)
        self.assertTrue(all("model(" in r for r in results))

    async def test_kill_on_cancel(self):
        lease = await self.pool.acquire()
        proc = lease.proc
        got = asyncio.Event()

        async def run():
            async for _ in lease.generate("chest", SIZE):
                got.set()
                await asyncio.sleep(10)
        task = asyncio.create_task(run())
        await asyncio.wait_for(got.wait(), 5)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await asyncio.sleep(0.3)
        self.assertIsNotNone(proc.returncode)
        self.assertTrue(await self.pool.wait_ready(2, 5))

    async def test_default_command_uses_isolation_flags(self):
        for flag in ("--setting-sources", "--strict-mcp-config", "--disable-slash-commands", "--tools", "--model"):
            self.assertIn(flag, CLAUDE_ARGS)
        self.assertEqual(CLAUDE_ARGS[CLAUDE_ARGS.index("--model") + 1], "claude-haiku-5-5")


class PoolFailureTests(unittest.IsolatedAsyncioTestCase):
    async def test_failed_spawn_does_not_deadlock(self):
        pool = make_pool(command=[sys.executable, "-c", "import sys; sys.exit(1)"])
        await pool.start()
        t = time.time()
        with self.assertRaises(PoolUnavailable):
            await asyncio.wait_for(pool.acquire(), 5)
        self.assertLess(time.time() - t, 5)
        await pool.close()


@unittest.skipUnless(os.environ.get("LIVE_CLAUDE") == "1", "set LIVE_CLAUDE=1 for the real claude")
class LivePoolTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_one_prompt(self):
        prompt = pathlib.Path(__file__).resolve().parents[3] / "docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt.txt"
        pool = Pool(size=1, system_prompt_path=str(prompt))
        await pool.start()
        self.assertTrue(await pool.wait_ready(1, 60))
        lease = await pool.acquire()
        text = "".join([d async for d in lease.generate("wooden barrel", SIZE)])
        models = set(lease.models)
        await lease.release()
        await pool.close()
        self.assertIn("//---STAGE---", text)
        self.assertEqual(models, {"claude-haiku-5-5"})


if __name__ == "__main__":
    unittest.main()
