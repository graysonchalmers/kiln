#!/usr/bin/env python3
"""Live Blockout server. `python3 live/server/main.py [--port N] [--host H] [--prompt PATH]`; --port 0 = OS port."""
import argparse
import asyncio
import pathlib
import shutil
import subprocess
import tempfile

import config
from pool import Pool
from prompt_router import Router
from ws_server import Server


def default_host() -> str:
    """Tailscale address if available (reachable from the Legion, not the whole LAN), else loopback."""
    if shutil.which("tailscale"):
        try:
            ip = subprocess.run(["tailscale", "ip", "-4"], capture_output=True, text=True, timeout=5).stdout.split()
            if ip:
                return ip[0]
        except (subprocess.TimeoutExpired, OSError):
            pass
    return "127.0.0.1"


async def amain(args) -> None:
    if args.plan:  # one part-list prompt with both examples; no router (a router call cost 1 to 2 s of every request in the first eval)
        path = pathlib.Path(tempfile.mkdtemp(prefix="liveblockout-prompts-")) / "plan.txt"
        examples = "\n\n".join(config.PLAN_EXAMPLES[k].read_text().strip() for k in ("manmade", "organic"))
        path.write_text(config.PLAN_PROMPT_PATH.read_text().replace("{{EXAMPLE}}", examples))
        pool = Pool(size=2, system_prompt_path=str(path))
        await pool.start()
        pools = {"manmade": pool}
    else:
        pool = Pool(size=2, system_prompt_path=str(args.prompt))
        await pool.start()
        pools = {"manmade": pool}
    if args.organic_prompt and not args.plan:  # two tuned prompts: man-made things and organic things, picked per request by prompt_router
        pools["organic"] = Pool(size=1, system_prompt_path=str(args.organic_prompt))
        await pools["organic"].start()
    router = None
    if len(pools) > 1:
        asker = Pool(size=1, system_prompt_path=str(config.ROUTER_PROMPT_PATH))  # one warm process that answers "organic" or "manmade"
        await asker.start()

        async def ask(prompt: str) -> str:
            lease = await asker.acquire()
            out = ""
            try:
                async for d in lease.followup(prompt):
                    out += d
            finally:
                await lease.release(kill=True)
            return out
        router = Router(pools, ask=ask)
    server = Server(pool, pathlib.Path(tempfile.mkdtemp(prefix="liveblockout-")), pool_for=router.pool_for if router else None)
    await server.start(args.host, args.port)
    print(f"PORT={server.port} HOST={args.host}", flush=True)
    seen = 0
    while True:  # log each spawn-to-ready time so respawn cost is visible
        await asyncio.sleep(2)
        for secs in pool.respawn_seconds[seen:]:
            print(f"respawn_ready_s={secs:.1f}", flush=True)
        seen = len(pool.respawn_seconds)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=config.PORT)
    ap.add_argument("--host", default=None)
    ap.add_argument("--prompt", type=pathlib.Path, default=config.PROMPT_PATH)
    ap.add_argument("--no-repair", action="store_true", help="do not pull parts that float beside the body back to it (server/repair.py)")
    ap.add_argument("--validate", action="store_true", help="check the sampled shape and retry once with the problems named")
    ap.add_argument("--ascii", action="store_true", help="with --validate: the retry message also carries 24x24 text silhouettes of the shape")
    ap.add_argument("--observe", action="store_true", help="report the validator results in `done` without acting on them (eval baseline)")
    ap.add_argument("--plan", action="store_true", help="the model writes a part list that parts.py compiles (prompt and examples: see config.PLAN_*); one prompt, no router")
    ap.add_argument("--organic-prompt", type=pathlib.Path, default=config.ORGANIC_PROMPT_PATH, help="the prompt for organic things (plants, creatures, characters), picked by the router")
    ap.add_argument("--single-prompt", action="store_true", help="no router and no organic prompt: every request uses --prompt (the baseline for evals)")
    a = ap.parse_args()
    a.host = a.host or default_host()
    config.REPAIR = not a.no_repair
    config.VALIDATE = a.validate
    config.OBSERVE = a.observe or a.validate
    config.ASCII = a.ascii
    config.PLAN = a.plan
    if a.single_prompt:
        a.organic_prompt = None
    try:
        asyncio.run(amain(a))
    except KeyboardInterrupt:
        pass
