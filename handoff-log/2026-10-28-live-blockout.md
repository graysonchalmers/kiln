# Live Blockout: built on `live-blockout-build` (2026-10-28)

## What happened
Brainstorm of "draw a box in a 3D level, type a prompt, watch the asset get built" became a design doc, a plan and a working
build in one session. Spikes first (all throwaway, in the scratchpad): kiln builds a voxel prop in ~0.5 s; Haiku writes
recognizable kiln scripts (local 4B model did not); a pool of 2 warm isolated `claude` processes gets the first level in ~3 s of
server time vs 5-9 s cold; TRELLIS.2 refine is far too slow for live (ComfyUI cold start alone >10 min under memory pressure).
Godot 4.7.2 on the Legion is the client; the Envy runs the server.

## Decisions and why
- Stages became a **resolution ladder** after Grayson's first run (stage 1 and 2 looked alike): one model-written `f(u,v,w)`
  sampled once on a 64^3 master, pooled into 4/8/16/32 cells with one rule. The first spike switched pooling rules between
  levels and features vanished; a single master fixed it.
- Thin parts kept per material (1.5 cells), a thin minority material covering 2% of a cell wins its key, and a thin part only
  claims a cell where it is at least as strong as its axis neighbours (else a 0.1 m wall ballooned by a cell; found by the
  13-prop set, test added).
- `solidify` fills sealed voids so shapes are built solid; open shapes stay open.
- Client draws individual bricks (server sends grid + palette next to the GLB; GLB kept for lock). Six transition styles in one
  shader (`voxel_sweep.gdshader`); implode is the default (Grayson's pick). Settings saved in `user://settings.cfg`.
- Server binds the tailnet IP only (no auth, spends the subscription); fixed port 8795 registered in `_agent-commons/reference/ports.md`.
- Nested `claude -p` must be isolated (`--setting-sources "" ...`): plain runs load Grayson's config and bill Opus (~$1.95 notional).
  The $1 cap is API credits only (rule fixed in `CLAUDE.shared.md`).

## Mistakes found (all fixed, tests added)
Scrub/lock keys silently unbound in the first client (patch tab-depth); pool drained after a cancelled release; ladder
sampling thresholds differed per level; thin walls ballooned; brick colours washed out (instance colour needs sRGB to linear).

## Ruled out / not done
Metaball or smooth meshing (kiln has none; `smooth`/`bevel` do nothing to voxel faces); TRELLIS stage (too slow); hedging two
requests to cut model stalls (untested); `--demo` time-lapse and five-prop acceptance run (plan Task 8); headless renders.

## Numbers
First real level median 4.7 s (range 4.3-8.6 s); model reply 2.75-6.8 s; server work after the function 1.4-2.2 s. 49 server
tests; gallery SSIM 1.000 against the baseline.
