#!/usr/bin/env python3
"""Paired retry test: the SAME first attempt, then two retries from it: --validate (typed message) and --validate --ascii (typed + silhouettes).
Only first attempts with a trigger problem (floating after repair, short, ground) are retried, exactly as pipeline.run_request does, on the
pool the router picked. Saves each case's three 32-cell grids; blind_triplets.py then makes the shuffled sheet.
usage: paired_retry.py OUTDIR [runs per prop, default 4]     (real isolated Haiku via the server's pool; run from the repo root)"""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "server"))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import config
from ladder import LadderError, eval_master, eval_palette, level_cells, solidify
from pipeline import _read_function, retry_note
from pool import Pool
from prompt_router import Router
from repair import bridge_floating
from validate import score, validate
import prompt_eval_props as P

OUT = pathlib.Path(sys.argv[1]); RUNS = int(sys.argv[2]) if len(sys.argv) > 2 else 4
OUT.mkdir(parents=True, exist_ok=True)


def prepare(pal_src, f_src):
    master = bridge_floating(solidify(eval_master(pal_src, f_src)), 96, 0.3, 24)[0]  # what grayson delivers (repair on)
    palette = eval_palette(pal_src)
    return {"master": master, "palette": palette, "problems": validate(master, set(palette) or None), "pal_src": pal_src}


def save(name, prep, size):
    cells = level_cells(prep["master"], 32)
    (OUT / f"{name}.json").write_text(json.dumps({"size": size, "n": 32, "cells": "".join(cells.reshape(-1)), "palette": prep["palette"],
                                                   "codes": [p["code"] for p in prep["problems"]]}))


async def attempt(pool, prompt, size, note=""):
    lease = await pool.acquire()
    try:
        return prepare(*await _read_function(lease.generate(prompt, tuple(size), note=note)))
    finally:
        await lease.release(kill=True)


async def main():
    pool = Pool(size=2, system_prompt_path=str(config.PROMPT_PATH)); await pool.start()
    pools = {"manmade": pool, "organic": Pool(size=1, system_prompt_path=str(config.ORGANIC_PROMPT_PATH))}
    await pools["organic"].start()
    asker = Pool(size=1, system_prompt_path=str(config.ROUTER_PROMPT_PATH)); await asker.start()

    async def ask(prompt):
        lease = await asker.acquire(); out = ""
        try:
            async for d in lease.followup(prompt):
                out += d
        finally:
            await lease.release(kill=True)
        return out
    router = Router(pools, ask=ask)
    await asyncio.sleep(15)
    cases = []
    for run in range(1, RUNS + 1):
        for name, (prompt, size) in P.ALL.items():
            try:
                p = await router.pool_for(prompt)
                first = await attempt(p, prompt, size)
            except (LadderError, Exception) as e:
                print(name, run, "first attempt failed:", str(e)[:80], flush=True); continue
            trig = [x for x in first["problems"] if x["code"] in config.TRIGGER_CODES]
            print(name, run, "triggers:", [x["code"] for x in trig], flush=True)
            if not trig:
                continue
            case = f"{name}_{run}"
            save(f"{case}__first", first, size)
            for tag, ascii_on in (("typed", False), ("ascii", True)):
                config.ASCII = ascii_on
                note = retry_note(first["problems"], first["master"])
                try:
                    r = await attempt(p, prompt, size, note)
                except Exception as e:
                    print(case, tag, "retry failed:", str(e)[:80], flush=True); continue
                save(f"{case}__{tag}", r, size)
            cases.append(case)
    config.ASCII = False
    (OUT / "cases.json").write_text(json.dumps(cases))
    (OUT / "done").write_text("DONE")
    print("cases", len(cases), flush=True)

asyncio.run(main())
