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
    pool = Pool(size=2, system_prompt_path=str(args.prompt))
    await pool.start()
    server = Server(pool, pathlib.Path(tempfile.mkdtemp(prefix="liveblockout-")))
    await server.start(args.host, args.port)
    print(f"PORT={server.port} HOST={args.host}", flush=True)
    await asyncio.Event().wait()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=config.PORT)
    ap.add_argument("--host", default=None)
    ap.add_argument("--prompt", type=pathlib.Path, default=config.PROMPT_PATH)
    a = ap.parse_args()
    a.host = a.host or default_host()
    try:
        asyncio.run(amain(a))
    except KeyboardInterrupt:
        pass
