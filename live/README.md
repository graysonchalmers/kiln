# Live Blockout

Draw a box in a Godot level, type what goes in it, and watch a voxel asset dial in: a solid block first, then
4, 8, 16 and 32 cell levels of one model-written shape. Design: `docs/superpowers/specs/2026-10-28-live-blockout-design.md`.
Plan and ledger: `docs/superpowers/plans/2026-10-28-live-blockout.md`.

## Run

**Envy (bash):** the server (Python 3 stdlib plus numpy, node, the `claude` CLI on the subscription login).
Port 8795 is registered in `_agent-commons/reference/ports.md`; it binds the Tailscale IP only.

```bash
cd ~/Projects-local/Tool-Blockout3D && python3 live/server/main.py
```

Tests and proofs use an OS port: `python3 live/server/main.py --port 0 --host 127.0.0.1` prints `PORT=<n>`.

**Legion (PowerShell):** the client (Godot 4.7.2 at `C:\Users\Grayson\AppData\Local\Programs\Godot`; the project
is copied to `C:\Users\Grayson\claude-tmp\live-client\`).

```powershell
powershell -NoProfile -File C:\Users\Grayson\claude-tmp\live-client\run_client.ps1
```

Controls: **B** draw a box (drag a footprint, wheel = height; the prompt bar opens on release), **Enter** build,
**Esc** cancel, **Left/Right** scrub levels, **L** lock the shown level's GLB to `assets/`,
**T** next transition style, **Tab** free the mouse, WASD/QE fly. Styles (`--style=<name|number>` or `VS_STYLE`): flip, plane,
sparks, scatter, implode (the reverse-particle one), dissolve.

## Tests

```bash
python3 -m unittest discover -s live/server/tests          # 49 tests, no network (SKIP_KILN=1 skips the slow kiln builds)
LIVE_CLAUDE=1 python3 -m unittest test_pool.LivePoolTests   # run from live/server/tests; uses the real claude
```

Godot (run on the Legion over `ssh legion`): `live/client/tests/parse_check.ps1 -Project <dir> -Script res://tests/test_protocol.gd`
(protocol, strip, pacer), `-Script res://tests/e2e.gd -UserArg --server=ws://<tailnet-ip>:8795` (needs a server).

## Smoke test (watch the transition without a server)

`--smoke` fills a fixed box with the four barrel levels (`live/client/tests/ladder_<n>.glb/.json`, made by
`live/tools/make_smoke_fixtures.py`) so you can see the transition: a glowing band of about 2-3 rows of bricks climbs
the box; each brick flips on its own, shrinking or growing about its own centre, with the old level still above the
band and the new one below it. Renders with Godot's Movie
Maker in the logged-in desktop session (a Godot window flashes for about 10 s).

```bash
ssh legion 'powershell -NoProfile -File C:\Users\Grayson\claude-tmp\live-client\tests\task_smoke.ps1 -Sheet "-From 1.35 -Len 1.0 -Tile 4x2 -SheetFps 8 -TileW 480"'
```

Output: `C:\Users\Grayson\claude-tmp\smoke\smoke.avi` plus `smoke.avi.png` (a frame sheet). Logic only, no window: `tests/run_smoke.ps1 -Headless`.

## Settings

`O` opens a small settings panel: transition style (flip, plane, sparks, scatter, implode, dissolve; **implode** by default).
It is saved to `user://settings.cfg` (Godot's per-user folder) and loads next time. `--style=<name|number>` or `VS_STYLE`
overrides it for one run; `T` cycles styles.

## Regression set

Thirteen props in `live/server/props.py` (barrel, mailbox, lamp, chest, vending, sphere, block, hollow_box, cup, arch,
mushroom, table, stairs; some exist to test the pipeline: a sealed shell must be filled solid, an open cup must stay open,
thin lamp and table legs must survive). `tests/test_props.py` checks each against `tests/golden_props.json` (fill per level,
materials present, triangle counts); regenerate the golden numbers only for a change you meant to make:
`python3 live/tools/update_golden.py`. `live/tools/gallery_check.sh` renders all 13 side by side on the Legion and compares
with `live/client/tests/baselines/gallery.png` by SSIM (`--update` to accept a new look).

## Windowless renders on Stealth (no popups, nothing on the Legion)

Godot's own `--headless` draws nothing, so renders use Xvfb with software Vulkan (lavapipe) on **Stealth**, at nice 19, with
no GPU lease taken. One-time setup, already done: the official Godot 4.7.2 Linux build at `~/live-blockout-render/godot` on
Stealth (SHA512 checked against the release's `SHA512-SUMS.txt`). Software and GPU renders differ in the last pixels, so
Stealth has its own baseline.

```bash
live/tools/gallery_check_stealth.sh              # ~50 s: render the 13-prop gallery and compare with baselines/gallery_stealth.png
live/tools/gallery_check_stealth.sh --update     # accept a new look
live/tools/stealth_render.sh out.avi --write-movie @OUT@ --fixed-fps 30 --quit-after 150 -- --smoke --style=implode   # ~1 min
```

`stealth_render.sh <out> <godot args>` syncs the client, runs Godot under Xvfb (`@OUT@` becomes the output path on Stealth)
and copies the file back. Checked 2026-10-28: gallery SSIM 1.000 on a repeat render, a 5 s implode clip renders correctly.

## Render timings (measured 2026-10-28)

Wall time from the Envy, including syncing the client, regenerating prop grids, rendering and fetching the result.

| Job | Legion (real GPU, a window flashes) | Stealth (software Vulkan, windowless, nice 19) |
|---|---|---|
| 13-prop gallery check | 33-36 s | 48 s; 55-65 s with SSAO lighting; 98 s the very first run |
| One style clip, 6 s / 180 frames (5 s / 150 on Stealth) | 16 s wall (9 s recording, 66% of real time) | 61 s wall (30 s recording, 16% of real time) |
| All six style clips (estimate, not run) | about 2 min plus ffmpeg | about 6-7 min |

Stealth is about 3x slower than the Legion GPU and does not interrupt anyone; use it for regression checks and batches, the Legion
for a quick look. Per-run numbers are appended to `~/.local/state/eta/actuals.jsonl`. Server side, the first real level takes a median 4.7 s.

## Lighting

Procedural sky with sky-sourced ambient light, a warm shadowed key light plus a cool unshadowed fill, filmic tonemap, SSAO, light
distance fog, and a bloom threshold of 1.0 so only the glowing bricks bloom. Resting bricks are seamless; a brick opens a 6% gap only
while it moves, and the skin is drawn two bricks deep so seams never show the empty inside.

## How it works

`pool.py` keeps 2 warm isolated Haiku processes (`--setting-sources "" --strict-mcp-config --disable-slash-commands
--tools "" --model claude-haiku-5-5`; plain `claude -p` loads your config and bills Opus). The model replies with
`pal({...})` and `function f(u,v,w)`. `ladder.py` samples `f` once on a 64^3 grid in a node `vm` sandbox, pools it into
levels with one rule (cells solid at 50% fill or when they hold a part thinner than 1.5 cells; a thin minority
material covering 2% of a cell wins its key), `solidify` first fills sealed interior voids so every shape is built solid (open shapes such as a cup stay open),
and `pipeline.py` builds each level with kiln and sends it over the WebSocket in `ws_server.py`: a stage event
with the voxel grid and palette, then the GLB. The client draws the grid as individual bricks (`voxel_view.gd`,
surface bricks only) and queues levels (`stage_pacer.gd`, 0.9 s each); the GLB is kept for locking to disk.

## Measured (2026-10-28, real server, warm pool, 5 props)

- Model reply until `f` is complete: 2.75-6.8 s, median about 3.0 s.
- Server work from `f` to the first level: 1.4-2.2 s (function sampling about 0.4 s, then the first kiln build).
- **First real level: median 4.7 s (range 4.3-8.6 s); 0 of 5 under 3 s.** The 3 s goal is met only by the client's
  instant block, not by the first real level. An earlier run before the block was dropped: median 6.0 s over 10 requests.
- Before the ladder (three staged scripts), stage 1 came at a median 2.6 s but stages 1 and 2 looked alike.
- Visual quality across the five props is not yet judged from the client; barrel and lamp read well in kiln previews,
  the vending machine depends on what the model writes.

## Known gaps

- Levels are voxel; kiln's `smooth` and `bevel` do nothing to them. A smoother final level needs another mesher.
- The model's function varies run to run (vending machine especially); no retry on a poor-looking result, only on a failed one.
- Hedging two requests to cut the 7-10 s model stalls is untested.
- Task 8 still to do: scripted `--demo` time-lapse video, five-prop acceptance run at the client.
- Legion renders pop a Godot window; use the Stealth route below for windowless renders.
