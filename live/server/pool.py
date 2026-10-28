"""Pool of warm, isolated Haiku `claude` processes. One prompt per process (fresh context)."""
import asyncio
import json
import time
from typing import AsyncIterator

CLAUDE_ARGS = ["claude", "-p", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
               "--tools", "", "--model", "claude-haiku-5-5", "--input-format", "stream-json",
               "--output-format", "stream-json", "--include-partial-messages", "--verbose"]
WARMUP = "warm-up: reply with the single word ok."


class PoolUnavailable(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _user_line(text: str) -> bytes:
    return (json.dumps({"type": "user", "message": {"role": "user", "content": text}}) + "\n").encode()


class Lease:
    def __init__(self, pool: "Pool", proc: asyncio.subprocess.Process):
        self.pool, self.proc, self.models, self.cost = pool, proc, set(), 0.0
        self._released = False

    async def generate(self, prompt: str, size_m: tuple[float, float, float]) -> AsyncIterator[str]:
        x, y, z = size_m
        async for d in self._stream(
                f"Box: {x:.2f} x {y:.2f} x {z:.2f} metres (width x height x depth); the prop must fill it.\nBuild: {prompt}"):
            yield d

    async def followup(self, text: str) -> AsyncIterator[str]:
        async for d in self._stream(text):
            yield d

    async def _stream(self, user_text: str) -> AsyncIterator[str]:
        self.proc.stdin.write(_user_line(user_text))
        await self.proc.stdin.drain()
        done = False
        try:
            async for line in self.proc.stdout:
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                if ev.get("type") == "stream_event":
                    e = ev["event"]
                    if e.get("type") == "content_block_delta" and e["delta"].get("type") == "text_delta":
                        yield e["delta"]["text"]
                elif ev.get("type") == "result":
                    self.models |= set((ev.get("modelUsage") or {}).keys())
                    self.cost = ev.get("total_cost_usd", 0.0)
                    done = True
                    break
            if not done:
                raise PoolUnavailable("generator process exited mid-reply")
        finally:
            if not done:
                await self.release(kill=True)

    async def release(self, kill: bool = False) -> None:
        if self._released:
            return
        self._released = True
        await self.pool._discard(self.proc, kill)


class Pool:
    def __init__(self, size: int = 2, system_prompt_path: str = "", command: list[str] | None = None):
        self.size, self.system_prompt_path, self._command = size, system_prompt_path, command
        self.respawn_seconds: list[float] = []
        self.reason: str | None = None
        self._ready: list[asyncio.subprocess.Process] = []
        self._spawning = 0
        self._cv = asyncio.Condition()
        self._closed = False
        self._tasks: set[asyncio.Task] = set()

    def _argv(self) -> list[str]:
        if self._command:
            return list(self._command)
        with open(self.system_prompt_path) as f:
            return CLAUDE_ARGS + ["--system-prompt", f.read()]

    async def start(self) -> None:
        self._refill()

    def _refill(self) -> None:
        while not self._closed and len(self._ready) + self._spawning < self.size:
            self._spawning += 1
            t = asyncio.create_task(self._spawn_one())
            self._tasks.add(t)
            t.add_done_callback(self._tasks.discard)

    async def _spawn_one(self) -> None:
        t0 = time.time()
        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *self._argv(), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL)
            proc.stdin.write(_user_line(WARMUP))
            await proc.stdin.drain()
            async for line in proc.stdout:
                try:
                    if json.loads(line).get("type") == "result":
                        break
                except ValueError:
                    continue
            else:
                raise RuntimeError("claude exited during warm-up")
            err = None
        except asyncio.CancelledError:
            if proc and proc.returncode is None:
                proc.kill()
            raise
        except Exception as e:  # spawn or warm-up failed
            err = f"{type(e).__name__}: {e}"
            if proc and proc.returncode is None:
                proc.kill()
        async with self._cv:
            self._spawning -= 1
            if err or self._closed:
                self.reason = err or self.reason
                if proc and proc.returncode is None:
                    proc.kill()
            else:
                self.reason = None
                self.respawn_seconds.append(time.time() - t0)
                self._ready.append(proc)
            self._cv.notify_all()

    async def wait_ready(self, n: int, timeout: float) -> bool:
        async def waiter():
            async with self._cv:
                await self._cv.wait_for(lambda: len(self._ready) >= n)
        try:
            await asyncio.wait_for(waiter(), timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def acquire(self) -> Lease:
        async with self._cv:
            while True:
                if self._ready:
                    proc = self._ready.pop(0)
                    break
                if self.reason and self._spawning == 0:
                    self._refill()  # recover for the next caller
                    raise PoolUnavailable(self.reason)
                await self._cv.wait()
        return Lease(self, proc)

    async def _discard(self, proc: asyncio.subprocess.Process, kill: bool) -> None:
        if proc.returncode is None:
            try:
                proc.kill() if kill else proc.terminate()
            except ProcessLookupError:
                pass
        await proc.wait()
        self._refill()

    async def close(self) -> None:
        self._closed = True
        for t in list(self._tasks):
            t.cancel()
        for p in self._ready:
            if p.returncode is None:
                p.kill()
                await p.wait()
        self._ready.clear()
