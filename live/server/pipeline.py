"""One generate request: the model writes a shape function, the server builds the 4/8/16/32-cell levels."""
import asyncio
import math
import pathlib
import time
from typing import Awaitable, Callable

from kiln_runner import build_glb
from ladder import (LEVELS, LadderError, eval_master, eval_materials, eval_palette, kiln_pal, level_cells, level_script, master_runs,
                    parse_reply, solidify)
from pool import PoolUnavailable

MAX_PROMPT = 500
MAX_DIM_M = 20.0
BUILD_PARALLEL = 2
Emit = Callable[[dict, "bytes | None"], Awaitable[None]]


def _bad_size(size) -> bool:
    try:
        vals = [float(v) for v in size]
    except (TypeError, ValueError):
        return True
    return len(vals) != 3 or any(not math.isfinite(v) or v <= 0 or v > MAX_DIM_M for v in vals)


async def _read_function(text_stream) -> tuple[str, str]:
    """Read the reply only until pal(...) and function f are complete, then stop (the rest is not needed)."""
    text = ""
    try:
        async for delta in text_stream:
            text += delta
            try:
                return parse_reply(text)
            except LadderError:
                continue
    finally:
        await text_stream.aclose()
    return parse_reply(text)  # raises bad_reply


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
    emitted = 0
    attempt = 0
    t_function = 0.0
    sem = asyncio.Semaphore(BUILD_PARALLEL)
    tasks: list[asyncio.Task] = []

    async def build_level(script: str, d: pathlib.Path):
        d.mkdir(parents=True, exist_ok=True)
        async with sem:
            return await asyncio.to_thread(build, script, d)

    async def make_levels(pal_src: str, f_src: str) -> str | None:
        """Build and emit every level; returns an error message if nothing could be emitted."""
        nonlocal emitted, attempt, t_function
        t_function = round(time.time() - t0, 3)  # the model's function is complete: levels can start
        attempt += 1
        master = await asyncio.to_thread(eval_master, pal_src, f_src)
        master = await asyncio.to_thread(solidify, master)  # no sealed voids: every shape is built solid
        palette = await asyncio.to_thread(eval_palette, pal_src)
        materials = await asyncio.to_thread(eval_materials, pal_src)
        grids: dict[int, dict] = {}
        started: list[tuple[int, asyncio.Task]] = []

        def start(n: int, script: str) -> None:  # builds begin as soon as each script exists
            t = asyncio.create_task(build_level(script, workdir / f"a{attempt}_l{n}"))
            tasks.append(t)
            started.append((n, t))

        runs = await asyncio.to_thread(master_runs, master)
        kiln_src = await asyncio.to_thread(kiln_pal, pal_src)  # kiln rejects the live-only `mat` tag
        for n in LEVELS:
            cells = await asyncio.to_thread(level_cells, master, n, runs)
            grids[n] = {"n": n, "cells": "".join(cells.reshape(-1)), "palette": palette,
                         "materials": materials}
            start(n, level_script("prop", kiln_src, cells, n, size_m))
        first_error = None
        for n, task in started:  # emit in level order as each build lands
            r = await task
            if r.ok:
                await emit({"type": "stage", "index": emitted, "level": n, "tris": r.tris, "grid": grids[n],
                            "t_function": t_function, "t_ready": round(time.time() - t0, 3)}, r.glb)
                emitted += 1
            else:
                first_error = first_error or r.error
        return None if emitted else (first_error or "no level could be built")

    try:
        error: LadderError | str | None = None
        try:
            pal_src, f_src = await _read_function(lease.generate(prompt, size_m))
            error = await make_levels(pal_src, f_src)
        except LadderError as e:
            error = e
        if error is not None:  # nothing was emitted: one retry
            msg = error.message if isinstance(error, LadderError) else error
            # Reading the first reply stops early and kills its process, so the retry runs on a fresh one with the
            # error in the request (a follow-up on the dead process raised ConnectionResetError and hid the real error).
            await lease.release(kill=True)
            lease = await pool.acquire()
            note = (f"A previous attempt failed: {msg}\n"
                    "Reply with only a corrected pal({...}) and function f(u,v,w){...}.")
            try:
                error = await make_levels(*await _read_function(lease.generate(prompt, size_m, note=note)))
            except LadderError as e:
                error = e
            if error is not None:
                code = error.code if isinstance(error, LadderError) else "build_failed"
                await emit({"type": "error", "code": code,
                            "message": error.message if isinstance(error, LadderError) else error}, None)
                return
        await emit({"type": "done", "stages": emitted}, None)
    except PoolUnavailable as e:
        await emit({"type": "error", "code": "generator_unavailable", "message": e.reason}, None)
    finally:
        for t in tasks:
            if not t.done():
                t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await lease.release(kill=True)
