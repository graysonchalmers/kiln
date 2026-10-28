"""One generate request: stream the model, build each stage with kiln, emit GLBs as they land."""
import asyncio
import math
import pathlib
import time
from typing import Awaitable, Callable

from kiln_runner import build_glb
from pool import PoolUnavailable
from stages import StageSplitter

MAX_PROMPT = 500
MAX_DIM_M = 20.0
Emit = Callable[[dict, "bytes | None"], Awaitable[None]]


def _bad_size(size) -> bool:
    try:
        vals = [float(v) for v in size]
    except (TypeError, ValueError):
        return True
    return len(vals) != 3 or any(not math.isfinite(v) or v <= 0 or v > MAX_DIM_M for v in vals)


async def run_request(pool, prompt: str, size_m, emit: Emit, workdir: pathlib.Path, build=build_glb) -> None:
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > MAX_PROMPT:
        await emit({"type": "error", "code": "bad_prompt", "message": f"prompt must be 1 to {MAX_PROMPT} characters"}, None)
        return
    if _bad_size(size_m):
        await emit({"type": "error", "code": "bad_size",
                    "message": f"size must be 3 numbers in (0, {MAX_DIM_M:g}] metres"}, None)
        return
    size_m = tuple(float(v) for v in size_m)
    try:
        lease = await pool.acquire()
    except PoolUnavailable as e:
        await emit({"type": "error", "code": "generator_unavailable", "message": e.reason}, None)
        return

    t0 = time.time()
    workdir = pathlib.Path(workdir)
    queue: asyncio.Queue = asyncio.Queue()
    state = {"emitted": 0, "scripts": 0, "last_error": None, "builds": 0}

    async def build_one(script: str):
        state["builds"] += 1
        d = workdir / f"b{state['builds']}"
        d.mkdir(parents=True, exist_ok=True)
        r = await asyncio.to_thread(build, script, d)
        if r.ok:
            await emit({"type": "stage", "index": state["emitted"], "tris": r.tris,
                        "t_ready": round(time.time() - t0, 3)}, r.glb)
            state["emitted"] += 1
        else:
            state["last_error"] = r.error
        return r.ok

    async def builder():
        while (script := await queue.get()) is not None:
            await build_one(script)

    btask = asyncio.create_task(builder())
    splitter = StageSplitter()
    try:
        async for delta in lease.generate(prompt, size_m):
            for s in splitter.feed(delta):
                state["scripts"] += 1
                queue.put_nowait(s)
        for s in splitter.finish():
            state["scripts"] += 1
            queue.put_nowait(s)
        queue.put_nowait(None)
        await btask
        if state["scripts"] == 0:
            await emit({"type": "error", "code": "no_stages", "message": "the generator returned no script"}, None)
            return
        if state["emitted"] == 0:
            retry = ""
            async for d in lease.followup(
                    f"That script failed to build: {state['last_error']}\nReply with only one corrected, complete script."):
                retry += d
            fixed = StageSplitter()
            scripts = fixed.feed(retry + "\n//---STAGE---\n")
            if not (scripts and await build_one(scripts[0])):
                await emit({"type": "error", "code": "build_failed", "message": str(state["last_error"])}, None)
                return
        await emit({"type": "done", "stages": state["emitted"]}, None)
    except PoolUnavailable as e:
        await emit({"type": "error", "code": "generator_unavailable", "message": e.reason}, None)
    finally:
        if not btask.done():
            btask.cancel()
        await asyncio.gather(btask, return_exceptions=True)
        await lease.release(kill=True)
