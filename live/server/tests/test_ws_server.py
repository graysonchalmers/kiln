import asyncio
import pathlib
import tempfile
import unittest
import _path  # noqa: F401
from ws_client import WsClient
from ws_server import Server


async def ok_run(pool, prompt, size, emit, workdir):
    await emit({"type": "stage", "index": 0, "tris": 12, "t_ready": 0.1}, b"glTF-fake")
    await emit({"type": "done", "stages": 1}, None)


class WsServerTests(unittest.IsolatedAsyncioTestCase):
    async def start(self, run):
        self.tmp = tempfile.TemporaryDirectory()
        self.server = Server(pool=None, workroot=pathlib.Path(self.tmp.name), run=run)
        await self.server.start("127.0.0.1", 0)
        return self.server.port

    async def asyncTearDown(self):
        await self.server.close()
        self.tmp.cleanup()

    async def test_handshake_and_stage_event_then_binary(self):
        c = await WsClient.connect(await self.start(ok_run))
        await c.send_json({"type": "generate", "prompt": "barrel", "size": [1, 2, 1]})
        ev = await asyncio.wait_for(c.recv(), 5)
        self.assertEqual(ev["type"], "stage")
        blob = await asyncio.wait_for(c.recv(), 5)
        self.assertEqual(blob[:4], b"glTF")
        self.assertEqual((await asyncio.wait_for(c.recv(), 5))["type"], "done")
        c.close()

    async def test_disconnect_cancels_request(self):
        cancelled = asyncio.Event()

        async def hang(pool, prompt, size, emit, workdir):
            try:
                await asyncio.sleep(60)
            except asyncio.CancelledError:
                cancelled.set()
                raise
        c = await WsClient.connect(await self.start(hang))
        await c.send_json({"type": "generate", "prompt": "barrel", "size": [1, 2, 1]})
        await asyncio.sleep(0.2)
        c.close()
        await asyncio.wait_for(cancelled.wait(), 3)

    async def test_bad_json_returns_error_not_crash(self):
        c = await WsClient.connect(await self.start(ok_run))
        await c.send_text("not json")
        ev = await asyncio.wait_for(c.recv(), 5)
        self.assertEqual((ev["type"], ev["code"]), ("error", "bad_request"))
        await c.send_json({"type": "generate", "prompt": "barrel", "size": [1, 2, 1]})
        self.assertEqual((await asyncio.wait_for(c.recv(), 5))["type"], "stage")
        c.close()

    async def test_second_generate_while_busy_is_rejected(self):
        gate = asyncio.Event()

        async def slow(pool, prompt, size, emit, workdir):
            await gate.wait()
            await emit({"type": "done", "stages": 0}, None)
        c = await WsClient.connect(await self.start(slow))
        await c.send_json({"type": "generate", "prompt": "a", "size": [1, 1, 1]})
        await c.send_json({"type": "generate", "prompt": "b", "size": [1, 1, 1]})
        ev = await asyncio.wait_for(c.recv(), 5)
        self.assertEqual(ev["code"], "busy")
        gate.set()
        c.close()


if __name__ == "__main__":
    unittest.main()
