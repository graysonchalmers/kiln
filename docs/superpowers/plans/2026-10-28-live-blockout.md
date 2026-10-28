# Live Blockout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw a box in a Godot level, send a prompt to the Envy, and watch kiln voxel stages stream into the box, scrub them, and lock one as a GLB.

**Architecture:** A stdlib-Python WebSocket server on the Envy keeps a pool of 2 warm isolated Haiku processes. It streams the model's `//---STAGE---` output, builds each complete stage with `kiln build --no-preview`, and sends each GLB to the Godot client (Legion), which fits it in the box with a bottom-up reveal.

**Tech Stack:** Python 3.14 stdlib only (no `websockets` installed), `unittest`; Godot 4.3+ GDScript on the Legion; `node bin/kiln.js`; `claude` CLI on the subscription login.

**Spec:** `docs/superpowers/specs/2026-10-28-live-blockout-design.md` (stage prompt: `docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt.txt`). Spike code to reuse, not ship as-is: `live/spikes/` (see its README).

## Global Constraints

- Every `claude` process uses exactly: `claude -p --setting-sources "" --strict-mcp-config --disable-slash-commands --tools "" --model claude-haiku-5-5`, plus `--input-format stream-json --output-format stream-json --include-partial-messages --verbose` for warm processes. Plain `claude -p` bills Opus.
- No Anthropic API key is used, created or searched for. Subscription login only.
- Server is Python stdlib only. Tests use `unittest`, run as `python3 -m unittest discover -s live/server/tests`. Suites over ~2 min go through `~/Projects/_agent-commons/tools/envy-heavy -n live-blockout -- <cmd>`.
- Tests and proofs bind port 0. The long-lived server takes one fixed port, registered in `_agent-commons/reference/ports.md` after `ss -ltn` shows it free. Tests never use it.
- kiln build is always `node bin/kiln.js build --no-preview <file>` (from `Tool-Blockout3D/`); output GLB at `<outdir>/models/<name>.glb`.
- Godot is installed on the Legion only (`C:\Users\Grayson\claude-tmp\...`); never download or run Godot on the Envy. Legion commands run over `ssh legion` are scoped (named folder, no `-Wait`, no recursive drive searches).
- Stealth GPU and ComfyUI are not used. Do not touch `smoke/lod_wob/` (not ours).
- Work on branch `live-blockout-design`'s successor `live-blockout-build`; commit after every task; never commit `smoke/lod_wob/`.
- Generated scripts are untrusted text: run kiln only inside the kiln sandbox it already enforces, in a per-request temp dir, with a 10 s timeout.

## Review Focus

- Empty or whitespace prompt, or one over 500 chars: rejected with an `error` message, no model call.
- Box size zero, negative, NaN or over 20 m on any axis: rejected before any model call.
- Model returns no stage, only fences, or prose: client gets `error`, pool process is replaced, no hang.
- Client disconnects mid-stream: generation is cancelled, the process is killed and replaced, nothing leaks.
- Three prompts arrive back to back with a pool of 2: the third waits and still completes; no deadlock when a spawn fails.

---

### Task 1: Stage splitting and script cleaning

**Files:**
- Create: `live/server/stages.py`
- Test: `live/server/tests/test_stages.py`

**Interfaces:**
- Produces: `clean_script(text: str) -> str` (strips ``` fences and leading/trailing prose lines); `class StageSplitter` with `feed(chunk: str) -> list[str]` (returns newly completed stage scripts, in order, cleaned) and `finish() -> list[str]` (flushes the last stage if its `model(` parens balance, else drops it). Delimiter is the literal line `//---STAGE---`.

- [ ] **Step 1: Write failing tests** `test_split_across_chunks` (a 3-stage text fed in 7-char chunks yields exactly 3 scripts in order), `test_fences_stripped` (input wrapped in ```js fences yields no backticks), `test_unbalanced_last_stage_dropped` (cut-off final stage is not returned by `finish()`), `test_no_stage_returns_empty`.
- [ ] **Step 2: Run** `python3 -m unittest live.server.tests.test_stages` — expect ImportError/FAIL.
- [ ] **Step 3: Implement** both in `live/server/stages.py`; a stage is complete when the delimiter line arrives, or at `finish()` if parentheses balance. Take the balanced-paren detection from `live/spikes/server/driver.py`.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit** `feat(live): stage splitter and script cleaner`.

### Task 2: kiln runner

**Files:**
- Create: `live/server/kiln_runner.py`
- Test: `live/server/tests/test_kiln_runner.py`

**Interfaces:**
- Produces: `@dataclass BuildResult(ok: bool, glb: bytes | None, tris: int | None, error: str | None, seconds: float)`; `build_glb(script: str, workdir: pathlib.Path, timeout: float = 10.0) -> BuildResult`. Model name is whatever the script's `model("...")` declares; the runner finds the single `.glb` under `workdir/out/models/`.

- [ ] **Step 1: Write failing tests** `test_builds_known_script` (the vending-machine script from `live/spikes/godot/` expected tris 346, `glb[:4] == b"glTF"`), `test_syntax_error_returns_not_ok_with_message` (error text non-empty, glb None), `test_timeout` (script with an infinite loop returns not ok within 12 s).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `build_glb` with `subprocess.run(["node", "<repo>/bin/kiln.js", "build", "--no-preview", file, ...])`; check kiln's CLI for the output-dir flag and the tri-count line it prints (parse "N tris").
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(live): kiln build runner`.

### Task 3: Warm process pool

**Files:**
- Create: `live/server/pool.py`
- Test: `live/server/tests/test_pool.py`, fake generator `live/server/tests/fake_claude.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `class Pool(size: int = 2, system_prompt_path: str, command: list[str] | None = None)` with `async acquire() -> Lease`; `class Lease` with `async generate(prompt: str, size_m: tuple[float,float,float]) -> AsyncIterator[str]` (text deltas), `async release(kill: bool = False)`. Releasing starts a replacement spawn immediately (pre-spawn). `command` overrides the real claude command so tests can point at `fake_claude.py`. `Pool.respawn_seconds: list[float]` records each spawn-to-ready time.
- Isolation flags come from Global Constraints and live in one constant `CLAUDE_ARGS`.

- [ ] **Step 1: Write failing tests** against `fake_claude.py` (reads stream-json lines on stdin, emits `text_delta` events then a `result`): `test_streams_deltas_in_order`, `test_release_prespawns_replacement` (ready count back to 2 within 2 s), `test_third_acquire_waits_then_completes` (3 concurrent acquires, all finish, no deadlock), `test_failed_spawn_does_not_deadlock` (command that exits immediately: `acquire` raises `PoolUnavailable` within 5 s), `test_kill_on_cancel` (cancelling `generate` kills the process and the pool still reaches size 2).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with `asyncio.create_subprocess_exec`; base on `live/spikes/server/warm.py` but one prompt per process (fresh context). The user message includes the prompt and the box size in metres so the model can scale grids. `PoolUnavailable` carries a `reason` string for the client.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Add a live test** `test_live_one_prompt` (skipped unless `LIVE_CLAUDE=1`): real pool, prompt "wooden barrel", asserts at least one `//---STAGE---` appears and `modelUsage` shows only `claude-haiku-5-5`.
- [ ] **Step 6: Commit** `feat(live): warm Haiku pool`.

### Task 4: Request pipeline

**Files:**
- Create: `live/server/pipeline.py`
- Test: `live/server/tests/test_pipeline.py`

**Interfaces:**
- Consumes: `StageSplitter` (Task 1), `build_glb` (Task 2), `Pool`/`Lease` (Task 3).
- Produces: `async run_request(pool, prompt: str, size_m: tuple[float,float,float], emit: Callable[[dict, bytes | None], Awaitable[None]], workdir: pathlib.Path) -> None`. Emits, in order: `{"type":"stage","index":int,"tris":int,"t_ready":float}` with the GLB bytes, then `{"type":"done","stages":int}`; or `{"type":"error","code":str,"message":str}`. Codes: `bad_prompt`, `bad_size`, `no_stages`, `generator_unavailable`, `build_failed`.

- [ ] **Step 1: Write failing tests** with a fake pool and stub builder: `test_emits_stage_per_complete_stage_before_stream_ends` (first stage emitted while generator still has output), `test_bad_prompt_and_size_rejected_without_model_call` (covers Review Focus: empty, over 500 chars, zero/negative/NaN/over 20 m), `test_retry_once_with_error_text_then_fallback` (stage 2 fails twice: stage 1 stays, an `error` is not emitted if an earlier stage succeeded; `done` carries the count), `test_no_stage_output_emits_no_stages_error`, `test_cancel_kills_lease`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `run_request`; building runs in a thread so streaming continues (see spike `driver.py`); retry re-asks the same lease once with the kiln error text appended.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(live): request pipeline with retry and fallback`.

### Task 5: WebSocket server

**Files:**
- Create: `live/server/ws_server.py`, `live/server/ws_proto.py` (RFC 6455 framing: `read_frame`, `write_frame`, handshake), `live/server/main.py`
- Modify: `_agent-commons/reference/ports.md` (new row for the fixed port)
- Test: `live/server/tests/test_ws_server.py`

**Interfaces:**
- Consumes: `run_request` (Task 4).
- Produces: CLI `python3 live/server/main.py [--port N] [--prompt PATH]` (default fixed port from `live/server/config.py`; `--port 0` binds an OS port and prints `PORT=<n>`). Protocol: client sends text `{"type":"generate","prompt":str,"size":[x,y,z]}`; server sends text event JSON, and for `stage` events immediately follows with one binary frame holding the GLB. One request at a time per connection.

- [ ] **Step 1: Write failing tests** with a stdlib client: `test_handshake_and_stage_event_then_binary` (fake pipeline, `glTF` magic on the binary frame), `test_disconnect_cancels_request`, `test_bad_json_returns_error_not_crash`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Reuse the framing code from `live/spikes/godot/stub_server.py`; split it into `ws_proto.py`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Pick the fixed port**: run `ss -ltn`, choose a free one, put it in `config.py` and a row in `ports.md`.
- [ ] **Step 6: Commit** `feat(live): websocket server, protocol and port`.

### Task 6: Server on the real pool, timed

**Files:**
- Create: `live/tools/measure_server.py`
- Modify: `live/server/main.py` (nothing unless the run shows a bug)

**Interfaces:**
- Consumes: the running server (Task 5).
- Produces: `python3 live/tools/measure_server.py --port N` prints per-prop `t_first_stage`, tris and stage count for the five props (rusty vending machine, wooden barrel, street lamp, treasure chest, mailbox), 2 rounds, and median first-stage time.

- [ ] **Step 1: Write the measurement script** (client of the protocol, timestamps from send to the first binary frame).
- [ ] **Step 2: Run** the server on port 0 and the script with `LIVE_CLAUDE=1`; expect median first-stage at or under 3.0 s and 10 of 10 under 5 s, as in the spikes. Report respawn times from `Pool.respawn_seconds`. If it misses, record the numbers in the plan's commit message rather than tuning blindly.
- [ ] **Step 3: Commit** `feat(live): server timing script`.

### Task 7: Godot client

**Files:**
- Create: `live/client/` (copy and fix `live/spikes/godot/{project.godot,main.tscn,main.gd,reveal.gdshader}` into it); split `main.gd` into `box_tool.gd`, `net.gd`, `asset_view.gd`, `stage_strip.gd` as it grows
- Test: `live/client/tests/parse_check.ps1` (Legion), `live/client/tests/test_protocol.gd` (headless script)

**Interfaces:**
- Consumes: protocol from Task 5.
- Produces: `Net.generate(prompt: String, size: Vector3)`, signals `stage_received(index: int, glb: PackedByteArray, tris: int)`, `finished(stages: int)`, `failed(code: String, message: String)`; `StageStrip` with `select(index)` and `lock() -> String` (writes `res://assets/<slug>_s<index>.glb`, returns the path).

- [ ] **Step 1: Copy the spike into `live/client/`** and run a Godot headless parse on the Legion over `ssh legion` (`godot --headless --path <folder> --quit`); fix every parse or API error found, listing them in the commit message. The spike flagged: shader holes (try `render_mode cull_disabled`), vertex colors not copied to the reveal material, `WebSocketPeer` buffer properties.
- [ ] **Step 2: Write `test_protocol.gd`**: feeds a recorded stage event plus a GLB (use `live/spikes/godot/vend.glb`) into `Net` and asserts `stage_received` fires with a `glTF` buffer.
- [ ] **Step 3: Implement the protocol client** (`net.gd`) against the server on port 0 started from Task 5; `generate` sends the JSON, binary frames pair with the preceding `stage` event.
- [ ] **Step 4: Implement the stage strip**: arrows or number keys scrub stages, the asset swaps without replaying the reveal unless the stage is new, Enter-locked stage writes the GLB into the project's `assets/` folder. Show `generator unavailable` or the server's message on `failed`.
- [ ] **Step 5: Replace the reveal swap** so each new stage reveals over 1.5 s bottom-up and the wireframe stays; fit uniformly to the box with the base on the box floor (the spike's logic).
- [ ] **Step 6: Run on the Legion with Grayson**: server on the Envy, client connects to `ws://envy:<port>` (fall back to an ssh tunnel if the tailnet blocks it). Capture what he sends and fix the loop.
- [ ] **Step 7: Commit** `feat(live): Godot client`.

### Task 8: End-to-end acceptance and docs

**Files:**
- Create: `live/README.md` (run steps for the Envy server and Legion client in labelled blocks), `live/tools/measure_client.gd` (writes `measure.json` with send-to-first-stage times when started with `--measure`)
- Modify: `README.md` (one line pointing at `live/`)

**Interfaces:**
- Consumes: Tasks 5 and 7.
- Produces: milestone 1 evidence.

- [ ] **Step 1: Implement `--measure` mode** in the client: runs the 5 props twice with a fixed 1 m x 2 m x 0.8 m box, writes timings.
- [ ] **Step 2: Run it on the Legion**; expected median send-to-first-stage at or under 3.0 s, all 5 props produce at least 2 stages, one stage locks to a file.
- [ ] **Step 2b: Demo video (Grayson asked, 2026-10-28).** Add `--demo` to the client: it scripts the whole interaction (camera flies in, a wireframe box is dragged on the floor, the prompt types itself into the field, stages stream in with the reveal, the strip scrubs back and locks one). Record with Godot's Movie Maker (`godot --path <client> --write-movie demo.avi --fixed-fps 30 -- --demo --port=<n>`) on the Legion in the logged-in desktop session (a scheduled task set to run only when Grayson is logged on; if that cannot start a window, hand him the one command). Make it a time-lapse (Grayson, 2026-10-28): ffmpeg `setpts` speeds the dead time (box drawing, typing, waiting for stages) to about 4x to 8x and holds real speed on each stage reveal, ending on a short hold of the locked asset, about 20 to 30 s total, MP4. Send with `SendUserFile`, and copy to `C:\Users\Grayson\Downloads\envy\` via `_agent-commons/tools/to-legion`. Run it for at least the vending machine and one more prop.
- [ ] **Step 3: Record the results** (numbers, respawn times, failures) in `live/README.md`; if the median misses 3.0 s, state the measured value and the likely cause.
- [ ] **Step 4: Commit** `docs(live): run steps and milestone-1 results`.

---

## Self-review notes

- Spec coverage: first voxels ~3 s (T6, T8), stages and scrub/lock (T7), fit-to-box (T7), isolation flags (Global Constraints, T3), port 0 vs fixed port (T5), generator unavailable (T3, T7), milestone 1 (T8). Voice and TRELLIS are non-goals and have no task.
- Types: `BuildResult`, `Lease.generate`, `run_request` and the `stage`/`done`/`error` events are used the same way in later tasks.
- Proportion: bodies are left to the implementer; steps give signatures, test names and pass criteria.
