#!/usr/bin/env python3
"""Run a prop group through a running server, twice per prop, and save each run's 32-cell grid.
usage: prompt_eval.py PORT OUTDIR GROUP    (GROUP = organic | manmade | all; all = the 12 props of the better-builds eval)
Also writes OUTDIR/results.jsonl: one row per request (ok, error, latency_s, the server's `checks` report)."""
import asyncio, base64, json, os, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "server"))
import ws_proto

GROUPS = {
    "organic": {
        "mushroom": ("stylised mushroom house: big red spotted cap roof, cream round stem with a small door and a window", [1.0, 1.1, 1.0]),
        "oaktree": ("stylised oak tree with a thick trunk, a few branches and a round leafy crown", [1.0, 1.6, 1.0]),
        "frog": ("stylised green frog sitting upright, big eyes, wide mouth, front and back legs", [0.8, 0.7, 0.8]),
        "cactus": ("stylised saguaro cactus with two upturned arms and a few flowers", [0.8, 1.4, 0.5]),
        "knight": ("stylised knight in plate armour standing, helmet with a visor, a sword and a shield", [0.7, 1.7, 0.5]),
        "slime": ("stylised friendly slime blob with big eyes and a small crown", [0.8, 0.7, 0.8]),
    },
    "manmade": {
        "potion": ("stylised potion bottle: round glass flask with a long neck, a cork stopper and glowing liquid inside", [0.5, 0.8, 0.5]),
        "lantern": ("stylised hanging lantern: metal frame, a glowing flame inside glass panes, a top ring and a base", [0.5, 0.9, 0.5]),
        "chest": ("stylised treasure chest: wooden body, rounded lid, iron bands, a gold lock", [0.9, 0.6, 0.55]),
        "bucket": ("stylised wooden water bucket: tapered wooden staves, two iron hoops, a rope handle arching over the top", [0.5, 0.55, 0.5]),
        "signpost": ("stylised wooden signpost: a tall post with two arrow-shaped planks pointing opposite ways", [0.8, 1.6, 0.25]),
        "crate": ("stylised military ammo crate: olive wooden box, metal latches, a hinged lid and rope handles", [1.0, 0.5, 0.6]),
    },
}

async def one(port, out, name, run, prompt, size):
    r, w = await asyncio.open_connection("127.0.0.1", port)
    key = base64.b64encode(os.urandom(16)).decode()
    w.write(f"GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
    await r.readuntil(b"\r\n\r\n"); t0 = time.time()
    w.write(ws_proto.frame(ws_proto.TEXT, json.dumps({"type": "generate", "prompt": prompt, "size": size}).encode(), mask=True)); await w.drain()
    last, grid, row = None, None, {"name": name, "run": run, "ok": False}
    while True:
        _, op, d = await ws_proto.read_frame(r)
        if op == ws_proto.TEXT:
            e = json.loads(d)
            if e["type"] == "stage": last = e
            elif e["type"] == "done":
                row.update(ok=True, checks=e.get("checks"), stages=e.get("stages"), skipped=e.get("skipped"))
                break
            elif e["type"] == "error":
                row.update(error=f'{e.get("code")}: {e.get("message", "")[:120]}')
                print(name, run, "ERROR", row["error"], flush=True); break
        elif op == ws_proto.BINARY and last and last["level"] == 32:
            grid = {"size": size, **last["grid"]}
            print(name, run, round(time.time() - t0, 1), "s", last["tris"], "tris", last["grid"]["materials"], flush=True)
    row["latency_s"] = round(time.time() - t0, 2)
    if grid:
        (out / f"{name}_{run}.json").write_text(json.dumps({**grid, "checks": row.get("checks")}))
    with open(out / "results.jsonl", "a") as f:
        f.write(json.dumps(row) + "\n")
    w.close()

async def main(port, out, group):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    for run in (1, 2):
        items = {**GROUPS["organic"], **GROUPS["manmade"]} if group == "all" else GROUPS[group]
        for name, (prompt, size) in items.items():
            await one(port, out, name, run, prompt, size)

asyncio.run(main(int(sys.argv[1]), sys.argv[2], sys.argv[3]))
