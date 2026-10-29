"""One generate request: the model writes a shape function, the server builds the 4/8/16/32-cell levels."""
import asyncio
import json
import math
import re
import pathlib
import time
from typing import Awaitable, Callable

import numpy as np

import config
from damage import damage
from repair import bridge_floating
from parts import PARTS_TAG, compile_parts, parse_parts, parse_plan_reply
from silhouette import silhouettes
from validate import score, validate
from kiln_runner import build_glb
from ladder import (LEVELS, LadderError, eval_master, eval_materials, eval_palette, kiln_pal, level_cells, level_script, master_runs,
                    parse_reply, solidify)
from pool import PoolUnavailable

MAX_PROMPT = 500
MAX_DIM_M = 20.0
MAX_GRID_N = 64
DAMAGE_MODES = ("burn", "break")
MAX_AMOUNTS = 64
MAX_WORK = 1_000_000   # n^3 cells x amounts per request: a 32-cell burn of 24 steps is 786k; the worst 64-cell step costs about 3 s
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
                got = parse_plan_reply(text) if config.PLAN else None
                if got:
                    return got
                continue
    finally:
        await text_stream.aclose()
    return (parse_plan_reply(text, final=True) if config.PLAN else None) or parse_reply(text)  # raises bad_reply


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
    skipped: list[dict] = []  # levels whose kiln build failed: reported in the done event, never silently dropped

    async def build_level(script: str, d: pathlib.Path):
        d.mkdir(parents=True, exist_ok=True)
        async with sem:
            return await asyncio.to_thread(build, script, d)

    async def prepare(pal_src: str, f_src: str) -> dict:
        """Sample f into the master volume and run the repair and the checks; nothing is built or sent yet."""
        nonlocal attempt, t_function
        attempt += 1
        t_function = round(time.time() - t0, 3)  # the model's function is complete: levels can start
        if f_src.startswith(PARTS_TAG):  # a part list: compiled by numpy, nothing the model wrote is executed
            master = await asyncio.to_thread(lambda: compile_parts(parse_parts(f_src[len(PARTS_TAG):]))[0])
            if not (master != ".").any():
                raise LadderError("empty", "the part list produced nothing inside the unit cube")
        else:
            master = await asyncio.to_thread(eval_master, pal_src, f_src)
        master = await asyncio.to_thread(solidify, master)  # no sealed voids: every shape is built solid
        if config.REPAIR or config.VALIDATE:  # parts floating beside the body slide back to it (sizes scaled from the 32-cell values: x8 volume at 64)
            master, _ = await asyncio.to_thread(bridge_floating, master, 96, 0.3, 24)
        palette = await asyncio.to_thread(eval_palette, pal_src)
        materials = await asyncio.to_thread(eval_materials, pal_src)
        problems = await asyncio.to_thread(validate, master, set(palette) or None) if (config.VALIDATE or config.OBSERVE) else []
        return {"pal_src": pal_src, "master": master, "palette": palette, "materials": materials, "problems": problems,
                "attempt": attempt, "t_function": t_function}

    async def emit_levels(prep: dict) -> str | None:
        """Build and emit every level of a prepared shape; returns an error message if nothing could be emitted."""
        nonlocal emitted
        skipped.clear()
        master, palette, materials, pal_src = prep["master"], prep["palette"], prep["materials"], prep["pal_src"]
        grids: dict[int, dict] = {}
        started: list[tuple[int, asyncio.Task]] = []

        def start(n: int, script: str) -> None:  # builds begin as soon as each script exists
            t = asyncio.create_task(build_level(script, workdir / f"a{prep['attempt']}_l{n}"))
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
                            "t_function": prep["t_function"], "t_ready": round(time.time() - t0, 3)}, r.glb)
                emitted += 1
            else:
                first_error = first_error or r.error
                skipped.append({"level": n, "error": (r.error or "")[-160:]})
        return None if emitted else (first_error or "no level could be built")

    def triggers(prep: dict) -> list[dict]:
        return [p for p in prep["problems"] if p["code"] in config.TRIGGER_CODES]

    try:
        error: LadderError | str | None = None
        first: dict | None = None
        final: dict | None = None
        retried = False
        try:
            first = final = await prepare(*await _read_function(lease.generate(prompt, size_m)))
        except LadderError as e:
            error = e
        if first is not None and config.VALIDATE and triggers(first):  # ONE retry that names what is wrong; keep the better attempt
            retried = True
            note = retry_note(first["problems"], first["master"])
            await lease.release(kill=True)
            lease = await pool.acquire()
            try:
                second = await prepare(*await _read_function(lease.generate(prompt, size_m, note=note)))
                if score(second["problems"]) < score(first["problems"]):
                    final = second
            except LadderError:
                pass
        if final is not None:
            error = await emit_levels(final)
        if error is not None and not retried:  # nothing was emitted: one retry
            msg = error.message if isinstance(error, LadderError) else error
            # Reading the first reply stops early and kills its process, so the retry runs on a fresh one with the
            # error in the request (a follow-up on the dead process raised ConnectionResetError and hid the real error).
            await lease.release(kill=True)
            lease = await pool.acquire()
            note = f"A previous attempt failed: {msg}\n{_reply_hint()}"
            retried = True
            try:
                final = await prepare(*await _read_function(lease.generate(prompt, size_m, note=note)))
                error = await emit_levels(final)
            except LadderError as e:
                error = e
        if error is not None:
            code = error.code if isinstance(error, LadderError) else "build_failed"
            await emit({"type": "error", "code": code,
                        "message": error.message if isinstance(error, LadderError) else error}, None)
            return
        done = {"type": "done", "stages": emitted, **({"skipped": skipped} if skipped else {})}
        if config.VALIDATE or config.OBSERVE:  # same report in every arm of an eval
            done["checks"] = {"attempts": attempt, "retried": retried, "picked": final["attempt"],
                              "first": [p["code"] for p in first["problems"]] if first else None,
                              "final": [p["code"] for p in final["problems"]]}
        await emit(done, None)
    except PoolUnavailable as e:
        await emit({"type": "error", "code": "generator_unavailable", "message": e.reason}, None)
    finally:
        for t in tasks:
            if not t.done():
                t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await lease.release(kill=True)


def _reply_hint() -> str:
    return ("Reply with only a corrected pal({...}) and part list ending with a line `end`." if config.PLAN
            else "Reply with only a corrected pal({...}) and function f(u,v,w){...}.")


def retry_note(problems: list[dict], master) -> str:
    """The retry message: the problems, one sentence each, then what to send back."""
    lines = "\n".join(f"- {p['text']}" for p in problems)
    look = ("\nThis is how that shape looks (one letter per palette key, . = empty air):\n\n" + silhouettes(master) + "\n\n") if config.ASCII else "\n"
    return (f"A previous attempt built a shape with these problems:\n{lines}{look}"
            f"Fix exactly these and keep everything else. {_reply_hint()}")


def _parse_damage(req: dict):
    """(cells (n,n,n), palette, materials, amounts, seed, mode, size, want_glb) from a damage request; ValueError(code, msg) if bad."""
    g = req.get("grid")
    n = g.get("n") if isinstance(g, dict) else None
    if isinstance(n, float) and n.is_integer():  # Godot's JSON has only floats
        n = int(n)
    if not isinstance(n, int) or isinstance(n, bool) or not 1 <= n <= MAX_GRID_N:
        raise ValueError(("bad_grid", f"grid needs n between 1 and {MAX_GRID_N}"))
    cells = g.get("cells")
    if not isinstance(cells, str) or len(cells) != n ** 3:
        raise ValueError(("bad_grid", f"grid.cells must be a string of {n ** 3} characters"))
    pal = g.get("palette", {})
    mats = g.get("materials", {})
    if not isinstance(pal, dict) or not isinstance(mats, dict):
        raise ValueError(("bad_grid", "grid.palette and grid.materials must be objects"))
    raw = req.get("amounts", [req.get("amount", 0.5)])
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_AMOUNTS:
        raise ValueError(("bad_amount", f"amounts must be a list of 1 to {MAX_AMOUNTS} numbers"))
    try:
        amounts = [float(a) for a in raw]
        seed = int(req.get("seed", 0))
    except (TypeError, ValueError, OverflowError):
        raise ValueError(("bad_amount", "amount must be a number and seed an integer")) from None
    if any(not math.isfinite(a) or not 0.0 <= a <= 1.0 for a in amounts):
        raise ValueError(("bad_amount", "amount must be between 0 and 1"))
    if len(amounts) > 1 and req.get("glb"):
        raise ValueError(("bad_amount", "glb is only for a single amount"))
    if n ** 3 * len(amounts) > MAX_WORK:
        raise ValueError(("too_big", f"too much work: n^3 x amounts must be at most {MAX_WORK} (n={n} allows {max(1, MAX_WORK // n ** 3)} amounts)"))
    mode = req.get("mode", "burn")
    if mode not in DAMAGE_MODES:
        raise ValueError(("bad_mode", f"mode must be one of {', '.join(DAMAGE_MODES)}"))
    size = req.get("size")
    if size is not None and _bad_size(size):
        raise ValueError(("bad_size", f"size must be 3 numbers in (0, {MAX_DIM_M:g}] metres"))
    arr = np.array(list(cells)).reshape(n, n, n)
    return arr, pal, mats, amounts, seed & 0x7FFFFFFF, mode, tuple(float(v) for v in size) if size else (1.0, 1.0, 1.0), bool(req.get("glb"))


async def run_damage(req: dict, emit: Emit, workdir: pathlib.Path, build=build_glb) -> None:
    """Stateless damage: the request carries the grid. `amount` gives ONE `damaged` event; `amounts` (up to 64, same seed)
    gives one per amount, in order, streamed as each is ready: a burn the client can scrub or play. Every event has
    `index` and `count`; the last one ends the reply (no `done`). "glb": true adds the GLB frame (single amount only)."""
    try:
        arr, pal, mats, amounts, seed, mode, size, want_glb = _parse_damage(req)
    except ValueError as e:
        code, msg = e.args[0]
        await emit({"type": "error", "code": code, "message": msg}, None)
        return
    for i, amount in enumerate(amounts):
        out, pal2, mats2 = await asyncio.to_thread(damage, arr, mats, amount, seed, mode)
        grid = {"n": arr.shape[0], "cells": "".join(out.reshape(-1)), "palette": {**pal, **pal2}, "materials": {**mats, **mats2}}
        ev = {"type": "damaged", "index": i, "count": len(amounts), "amount": amount, "seed": seed, "mode": mode, "grid": grid}
        blob = None
        if want_glb:
            if not (out != ".").any():
                await emit({"type": "error", "code": "empty", "message": "nothing is left to build a model from"}, None)
                return
            pal_src = "pal(" + json.dumps({k: v for k, v in grid["palette"].items() if re.fullmatch(r"#[0-9a-fA-F]{6}", str(v))}) + ")"
            workdir = pathlib.Path(workdir)
            workdir.mkdir(parents=True, exist_ok=True)
            r = await asyncio.to_thread(build, level_script("prop", pal_src, out, arr.shape[0], size), workdir)
            if not r.ok:
                await emit({"type": "error", "code": "build_failed", "message": r.error or "kiln build failed"}, None)
                return
            ev["tris"], blob = r.tris, r.glb
        await emit(ev, blob)
