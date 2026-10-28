#!/usr/bin/env python3
"""Time the Live Blockout server. usage: measure_server.py --port N [--host H] [--rounds 2] [--gap 22]"""
import argparse
import asyncio
import base64
import json
import os
import pathlib
import statistics
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "server"))
import ws_proto  # noqa: E402

PROPS = ["rusty vending machine", "wooden barrel", "street lamp", "treasure chest", "mailbox"]
SIZE = [1.0, 2.0, 0.8]


async def one(host, port, prompt):
    r, w = await asyncio.open_connection(host, port)
    key = base64.b64encode(os.urandom(16)).decode()
    w.write(f"GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
    await r.readuntil(b"\r\n\r\n")
    t0 = time.time()
    w.write(ws_proto.frame(ws_proto.TEXT, json.dumps({"type": "generate", "prompt": prompt, "size": SIZE}).encode(), mask=True))
    await w.drain()
    first, stages, err = None, [], None
    while True:
        op, data = await asyncio.wait_for(ws_proto.read_message(r, w), 90)
        if op == ws_proto.BINARY:
            if first is None:
                first = time.time() - t0
        elif op == ws_proto.TEXT:
            ev = json.loads(data)
            if ev["type"] == "stage":
                stages.append((ev["tris"], ev["t_ready"], ev.get("t_function")))
            elif ev["type"] == "error":
                err = ev
                break
            elif ev["type"] == "done":
                break
    w.close()
    return first, stages, err


async def main(a):
    firsts = []
    for rnd in range(a.rounds):
        for prop in PROPS:
            first, stages, err = await one(a.host, a.port, prop)
            print(f"round {rnd + 1} {prop:22} first={first and round(first, 2)}s stages={len(stages)} "
                  f"fn={stages and stages[0][2]}s +build={stages and round(stages[0][1] - (stages[0][2] or 0), 2)}s "
                  f"tris={[s[0] for s in stages]} t_ready={[round(s[1], 1) for s in stages]} err={err and err['code']}", flush=True)
            if first is not None:
                firsts.append(first)
            await asyncio.sleep(a.gap)
    if firsts:
        print(f"median first={statistics.median(firsts):.2f}s under3={sum(f < 3 for f in firsts)}/{len(firsts)} "
              f"under5={sum(f < 5 for f in firsts)}/{len(firsts)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--rounds", type=int, default=2)
    ap.add_argument("--gap", type=float, default=22)
    asyncio.run(main(ap.parse_args()))
