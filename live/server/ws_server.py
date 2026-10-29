"""WebSocket front for run_request and run_damage. One request at a time per connection."""
import asyncio
import json
import pathlib
import tempfile

import ws_proto
from pipeline import run_damage, run_request


class Server:
    def __init__(self, pool, workroot: pathlib.Path, run=run_request, run_damage=run_damage):
        self.pool, self.workroot, self.run, self.run_damage = pool, pathlib.Path(workroot), run, run_damage
        self._srv = None
        self.port = None
        self._conns: set[asyncio.Task] = set()

    async def start(self, host: str, port: int) -> None:
        self._srv = await asyncio.start_server(self._handle, host, port)
        self.port = self._srv.sockets[0].getsockname()[1]

    async def close(self) -> None:
        if self._srv:
            self._srv.close()
        for t in list(self._conns):
            t.cancel()
        await asyncio.gather(*self._conns, return_exceptions=True)

    async def _handle(self, r, w) -> None:
        task = asyncio.current_task()
        self._conns.add(task)
        job: asyncio.Task | None = None
        send_lock = asyncio.Lock()

        async def send_event(ev: dict, blob: bytes | None = None) -> None:
            async with send_lock:
                w.write(ws_proto.frame(ws_proto.TEXT, json.dumps(ev).encode()))
                if blob is not None:
                    w.write(ws_proto.frame(ws_proto.BINARY, blob))
                await w.drain()

        async def run_job(req: dict) -> None:
            with tempfile.TemporaryDirectory(dir=self.workroot) as d:
                try:
                    if req.get("type") == "damage":
                        await self.run_damage(req, send_event, pathlib.Path(d))
                    else:
                        await self.run(self.pool, req.get("prompt"), req.get("size"), send_event, pathlib.Path(d))
                except asyncio.CancelledError:
                    raise
                except Exception as e:  # never kill the connection on a pipeline bug
                    await send_event({"type": "error", "code": "internal", "message": f"{type(e).__name__}: {e}"})

        try:
            if not await ws_proto.accept(r, w):
                return
            while True:
                op, data = await ws_proto.read_message(r, w)
                if op == ws_proto.CLOSE:
                    break
                try:
                    req = json.loads(data.decode()) if op == ws_proto.TEXT else None
                    if not isinstance(req, dict) or req.get("type") not in ("generate", "damage"):
                        raise ValueError("expected a generate or damage message")
                except (ValueError, UnicodeDecodeError, RecursionError) as e:  # RecursionError: JSON nested thousands deep
                    await send_event({"type": "error", "code": "bad_request", "message": str(e)[:200]})
                    continue
                if job and not job.done():
                    await send_event({"type": "error", "code": "busy", "message": "a request is already running"})
                    continue
                job = asyncio.create_task(run_job(req))
        except (asyncio.IncompleteReadError, ConnectionError):
            pass
        finally:
            if job and not job.done():
                job.cancel()
                await asyncio.gather(job, return_exceptions=True)
            w.close()
            self._conns.discard(task)
