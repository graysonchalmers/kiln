# Live Blockout: draw a box in the level, say what goes in it, watch it get built

Status: DRAFT for Grayson's approval (2026-10-28). Nothing here is built except throwaway spikes.

## Intent and why

Grayson wants asset creation to feel like watching a thing get built in front of him, inside the game
engine, not in a separate tool. In a stylized first-person 3D level he drags a box in 3D space. The box
is just a wireframe until he types or speaks a prompt ("rusty vending machine"). Within seconds a crude
voxel blob fills the box. Over the next minute it gets more detailed, stage by stage. He can flip back
through the stages and say where to stop; that stage becomes the asset. Speed matters most: the first
blob has to appear fast, and the waiting has to look good (streaming in, not a spinner).

Why now: kiln (Tool-Blockout3D) already turns small scripts into voxel/low-poly GLB in about half a
second, and a spike showed a small LLM can write those scripts fast enough.

## Goals

- First visible voxels about 3 s after submitting a prompt (measured median 3.0 s in a spike; 5 of 10
  runs under 3 s, 10 of 10 under 5 s).
- A solid block at 0 s, then four levels (4, 8, 16, 32 cells) once the model's function is complete,
  shown one per 0.9 s.
- The asset always fits the drawn box (bounds and base on the box floor).
- Scrub back and forth through the stages; lock a stage as the final asset (a GLB saved to disk).
- The build looks good while it happens: voxels reveal bottom-up with an edge band inside the wireframe.
- Typed prompt first; voice via Hey Server (Util-VoiceServer) when the core works.
- Runs from Godot on the Legion; generation on the Envy.

## Non-goals (for now)

- Unity or Unreal clients. Godot only.
- Stage-3 photoreal refinement through TRELLIS.2 / ComfyUI. Measured too slow for a live flow (documented
  about 5 to 10 min per prop, plus a ComfyUI cold start that exceeded 10 minutes under memory pressure).
  It may come later as an optional background stage that swaps in when ready. Not in this design.
- Multiple boxes generating at once. One box at a time.
- Editing an existing asset by prompt, animation, textures, collision, game-ready export polish.
- Any dependence on an Anthropic API key. None exists on the Envy.

## Anti-goals (a failure even if it technically works)

- A spinner followed by a finished model. The point is watching it build.
- A later stage that is worse than an earlier one with no way back. Scrubbing and locking are mandatory
  because the spikes showed later stages are sometimes worse (a barrel got noisy, a chest lost its lid).
- Anything that bills Opus or slows Stealth for other users of the box.

## What the spikes found (measured, 2026-10-28)

- kiln: 0.4 to 0.7 s per build with `--no-preview` (about 1.2 to 2 s with the 4-view preview).
- Haiku 5.5 via isolated `claude -p` writes recognizable props (5 of 5 after one retry in one-shot mode).
  A local 4B model on Stealth got 0 or 1 of 5 and took 10 to 16 s. Local is out for now.
- Cold `claude -p` per prompt: 0 of 12 under 3 s. A pool of 2 pre-warmed long-lived processes: median
  3.0 s to first GLB, none over 4.6 s. A single warm process had two 8 to 10 s stalls.
- Staged prompt works: the model emits several complete scripts separated by `//---STAGE---`, coarse blob
  first. Stage 1 text is done about 1.9 s after the prompt; each further stage about 1.2 s later.
- Stage quality is not monotonic (above). The mailbox once produced only two stages.
- Godot shell (box drawing, prompt, runtime GLB load, reveal shader, stub server) is written but has never
  been run. Treat the GDScript as unverified.

## Stage design: a resolution ladder (revised 2026-10-28, Grayson's idea)

Grayson's first run showed almost no difference between stage 1 and 2: the model wrote three blocky
scripts at finer grids. His fix, adopted: start with a solid block filling the box and "dial in" by
halving the cell size, like a 1 m block, then a 0.5 m block, and so on.

- The model writes ONE reply: `pal({...})` plus a pure function `f(u, v, w)` over the unit cube (u across,
  v up, w front/back) that returns a one-character palette key or null. No staged scripts.
- The server samples `f` once on a 64 x 64 x 64 master volume inside a node `vm` sandbox (6 s cap, no
  `require`, no code-from-strings), then builds levels by pooling that one volume: **4, 8, 16, 32 cells per
  side**, voxel grids scaled to the box so the mesh fits it exactly. The solid block (level 0) is drawn by
  the client itself the instant Enter is pressed, so the server does not build it (the 2-cell level
  duplicated the block and was dropped).
- One pooling rule for every level, so a level never lacks something a finer level has. A cell is solid
  when at least half its master voxels are occupied, or when it holds a part thinner than 1.5 cells
  (measured per material, so poles, hoops and inset windows count). A thin minority material covering 2% of a
  cell wins the cell's key. (The first spike switched rules between levels, which made features vanish; the
  pooled master fixes that.)
- Each level is built with kiln as soon as the previous finishes emitting, in parallel (3 at a time), and
  sent in level order. The client queues arriving levels and shows one per 0.9 s (`stage_pacer.gd`) so the
  dial-in is visible even when levels land together.
- Every shape is built solid: after sampling, sealed interior voids (empty voxels with no path to the outside) are
  filled with the surrounding material. Open shapes (a cup, an arch) are left open.
- The client draws each level as individual bricks (the server sends the voxel grid and palette in the stage event
  next to the GLB, which is kept for locking). One glowing band of about 2-3 rows climbs the box; a brick flips
  when the band passes its centre, the old level shrinking away and the new one growing in, each brick about its
  own centre, so the old level stays on screen until the new rows replace it.
- Voxel levels cannot be smoothed: kiln's `smooth`/`bevel` do nothing to axis-aligned voxel faces. A
  smooth final level would need a different mesher (marching cubes) and is out of scope.
- If `f` is missing, throws, times out or is empty, the server retries once on the same process with the
  error text; a level that fails to build is skipped and the rest continue.

Kiln has no metaball/SDF tool, so the coarse levels are blocky voxel blobs, not smooth ones.

## Shape of the system (decided in conversation, unless marked as my call)

1. Godot client (Legion): first-person fly camera, box mode, wireframe box, prompt field. On submit it
   sends `{prompt, size:[x,y,z]}` to the generation server and receives GLBs, one per stage.
2. Generation server (Envy): keeps a pool of 2 warm isolated Haiku processes (my call: pool size 2,
   replaced after each use). Reads the reply until `f` is complete, samples it into the master volume,
   builds the ladder levels with kiln and sends each GLB to the client, retrying once on a bad reply.
3. Client reveal: each arriving stage replaces the previous mesh, fitted to the box, with the bottom-up
   reveal. The wireframe stays. A stage strip lets him scrub and lock.
4. Transport: WebSocket on a port chosen by the OS (port 0, per repo rules), not a fixed port. (my call)

## Constraints

- Every nested `claude` call must be isolated: `--setting-sources "" --strict-mcp-config
  --disable-slash-commands --tools "" --model claude-haiku-5-5`. Plain `claude -p` loads Grayson's
  config and bills Opus (a spike hit about $1.95 notional that way). Subscription usage has no dollar
  cap; the cap applies only to API credits.
- Stealth GPU is not used in this design. If something is added later, it goes through `stealth-gpu`.
- Heavy or test runs go through `envy-heavy`. Test servers bind port 0.
- Godot is not installed on the Envy and was not downloaded there. It runs on the Legion.
- The prompt must make the asset fill the box; the box size is passed to the model as real dimensions.

## Left to the builder

- Protocol details (message shapes, how stage images are named, reconnect behavior).
- Prompt wording and number of stages (3 was used; 2 to 4 is fine), grid sizes, and how to scale the
  stage grids to the requested box dimensions.
- The scrub/lock UI, the reveal look, sounds.
- Validation beyond "kiln builds it": a cheap sanity check on tris and bounds.
- Project name and location (my call below).

## My calls (Grayson can override)

- Godot, not Unity.
- Prompt-to-script by Haiku through a warm process pool, not the local model and not TRELLIS.
- Stages are a resolution ladder of one model-written shape function (see Stage design), not image-to-3D.
- It lives in `Tool-Blockout3D` for now (it is a client and server around kiln); a separate repo is a
  later decision.
- Voice is a later step, using the existing Hey Server wake word and transcript, not a new recognizer.
- Hedging (racing two requests to cut the stall tail) is an optional later optimization, untested.

## Settled after the builder check

Answered by the project:
- Kiln interface: scripts use `pal({...})` plus `model("name", voxfn([nx,ny,nz], (x,y,z) => key|null,
  {size}))` (see `reference.md`). The working staged prompt is `2026-10-28-live-blockout-stage-prompt.txt` beside this doc (system prompt with
  one-shot example, `//---STAGE---` separator, tiny coarse grid first). Use it as the
  starting prompt. Fit-to-box: the server scales stage grids to the requested dimensions; the client also
  does a uniform fit and floor-snap as a safety net.
- Scrub/lock UI and file ownership are in the builder's hands below.

My calls (override freely):
- Auth and limits: the pool uses the Envy's logged-in subscription (no key). Quota or rate-limit errors
  must surface in the client as a visible "generator unavailable" state, not a hang. The generator sits
  behind one small interface so a different model (OpenRouter, a later API key) can replace it; the
  fallback today is a cold isolated `claude -p` per prompt (about 5 to 9 s to first voxels).
- Connection: the server is a long-lived service, so it takes one fixed port listed in
  `_agent-commons/reference/ports.md` (checked with `ss -ltn`); tests and proofs still use port 0. The
  Legion client connects to `ws://envy:<port>` over Tailscale. Raw WebSocket over the tailnet is
  untested; if blocked, fall back to an ssh tunnel.
- Storage: the server keeps each request's stages on the Envy under a per-request folder; locking makes
  the client write the chosen GLB (it already holds the bytes) into the Godot project's asset folder.
  Stages need not persist across sessions in the first milestone.
- Milestone 1 done means: the 5 spike props (vending machine, barrel, street lamp, treasure chest,
  mailbox) run through the real Godot client on the Legion with median first-voxels time of 3 s or less
  measured at the client, stages arrive and can be scrubbed, and one can be locked to a file.
- Pool: pre-spawn the replacement as soon as a process is taken; two back-to-back prompts are served by
  the two slots, a third waits or uses a cold process. Measure respawn time and report it.
- Verification of the Godot client: the builder can drive the Legion over `ssh legion` (scoped commands,
  Godot's `--headless --quit` for a parse check, no open-ended jobs). Looking at it is Grayson's job
  (screenshots he sends or a screen capture), so expect a short fix loop after the first run.

## Known risks

- The Godot GDScript and shader have never run: shader holes mid-reveal (may need `cull_disabled`),
  vertex colors not copied to the reveal material, WebSocket buffer properties unverified.
- 3 s depends on a warm pool; a cold or stalled process can cost 8 to 20 s.
- The model sometimes returns fewer stages than asked, or a syntax error (1 of 5 in one spike).
- Warm processes copy earlier answers from their history; a fresh process per prompt avoids it.
