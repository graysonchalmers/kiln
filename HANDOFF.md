# 🧭 Session Handoff — Tool-Blockout3D (text / image → 3D blockout generator)

_Last updated: 2026-10-28 18:30 CDT (Envy): Live Blockout materials pass, Legion baseline and insides prototype merged to `grayson`; story in `handoff-log/2026-10-28-live-blockout-materials.md` and `...-fast-3d-comparison.md`._

## 🎯 Current state
Text / image → 3D blockout generator on a fork of `uilianks/kiln` (MIT, low-poly assets as code → GLB). Origin = `graysonchalmers/kiln`, work on branch **`grayson`**; `main` mirrors upstream, no upstream PR planned.
- **Goal (Grayson, 2026-10-22):** text → blockout AND reference image → blockout, with a guaranteed quality floor, then into any engine.
- **Self-improving design loop exists now:** `docs/DESIGN-LOOP.md`. Steps: refs + 6-point bar → blind lens critics (form / color / construction) → written adjudication the critics argue back on → fix (scene, recipe or core) → fresh blind judge on per-asset shuffled pairs (`lib/grayson/ab.py`) → lessons into recipes + `text-to-glb` skill + goldens. Value tests: `lib/grayson/values.py <out>`.
- **Rounds so far (swamp):** r1 17/17. r2 9-4-3. r3 6-5-4 and lost the kit sheet (reverted). r4 beat r3 (9-2) and r2 (10 of 14 + kit sheet). r5 lost 6-3 first, kept its winners: kit sheet vs r4 after = current champion. Core: `tube` `top`/per-point radii, `rock({ flat })`, `settings({ mood })`, `cap`/`capAngle`, `blades({ bend })`, preview lights per corner (no seam); `trunk()` one mesh, branches upturn. Lint clean.
- **Image to blockout (2026-10-23):** `docs/IMAGE-TO-BLOCKOUT.md`, `lib/grayson/shot.ts` (matched camera), `lib/grayson/likeness.py` (silhouette IoU/aspect/hue). Kept (pack `img2blockout_best` in `smoke/img2blockout.kx.js`): broadleaf v2, pine v1, maple v5, boulder_r10a (crag chunks + loom `stone_mottle`), barrel_r7, crate_r11a (olive dark-band tint, stencil triangle + lid bars, no canvas flap). Camera: boulder yaw 0 / pitch 15, crate yaw -15 / pitch 15, `--bg #e6e6e6`. Core/recipes: `subtract()` (BSP cut), `hull()`, render `bg` / `shot.ts --bg`, `leaf({ angle })`, `canopy({ merge })`.
- **Target look (confirmed by Grayson 2026-10-27, Trust-your-pick):** Kenney Nature Kit clarity + Quaternius Stylized Nature gesture, swamp palette.
- Gate: `npm run check` (18/18) + `lib/grayson/golden.sh check` (12/12, repo-relative paths) + `node bin/kiln.js lint <scene>` (swamp clean) + `lib/grayson/values.py <out>` (worst of hero/front/right).

## 📌 Where we stopped
**Image to blockout r8-r11 (2026-10-25), merged to `grayson` 37a5d11.** r8: boulder crag chunks + crate dark-band olive won. r9: rust/grey chunks + stencil marks won. r10: mottled stone won; lower crate tied (kept champion). r11: crate canvas flap removed won; boulder wide right lobe lost, crevices tied. Per-round tables + lessons in `docs/IMAGE-TO-BLOCKOUT.md`. Proofs (gitignored, worktree `img2blockout-r8-9d2386`): `.proof/2026-10-25-img2blockout/r8..r11/`, copies in Legion Downloads\envy\. Swamp rounds paused at r5. Target-look Inbox row still open.

**Showcase (2026-10-25):** README has the swamp teaser (`docs/media/swamp_teaser.mp4`, 26.7 s, reel + chirp; sources in reel fork `grayson` `showcase/swamp/`, 5861d0f) and the loom before/after sheet. Sibling tools forked to graysonchalmers (`loom pxl vex chirp reel`, branch `grayson`), clones in `~/Projects-local/z-Git/uilianks/`.

## 🎬 Live Blockout (`live/`, merged into `grayson`)
Draw a box in a Godot level, type a prompt, watch a voxel asset dial in. Haiku writes one shape function `f(u,v,w)`; the Envy server (`live/server`, port 8795, tailnet IP) samples it once (64^3), fills sealed voids, pools 4/8/16/32-cell levels and sends grid + GLB; the Godot client on the Legion (`live/client`) draws bricks with six transition styles (default implode; settings panel `O`, saved). Run docs, tests, measured numbers: `live/README.md`. Design/plan: `docs/superpowers/{specs,plans}/2026-10-28-live-blockout*`. Gates: 49 server tests (`python3 -m unittest discover -s live/server/tests`, `SKIP_KILN=1` for the fast set), Godot tests over `ssh legion`, visual baselines `live/tools/gallery_check_stealth.sh` (windowless, ~50 s) and `gallery_check.sh` (Legion window), SSIM 1.000 on repeat. Branch merged into `grayson` 2026-10-28.
- First real level median 4.7 s (goal 3 s not met; model reply ~3 s). Server is stopped; start with `python3 live/server/main.py` (tailnet IP, port 8795).
- **Materials pass (kiln#1, #2; merged 2026-10-28):** material tag per palette key (`materials.py`, `grid.materials` in stage events), brick shader with loom textures, seam AO, rim, fresnel. Real prompts verified after the `mat:` palette fix: 5/5 clean, 4 stages each. 54 server tests. Both baselines refreshed (`gallery_stealth.png`, Legion `gallery.png`, kiln#4); `gallery_check.sh` passes at SSIM 1.000. New client synced to the Legion by hand (`live-client\`).
- **Insides prototype (kiln#5):** `damage()` burn/break, air key for hollow props, barrel demo; prompt, protocol and client NOT changed. Prompt variant on branch `lb-prompt-insides` (not merged): hollow insides most runs, worse mushrooms. Fast image-to-3D comparison (TripoSR 2.3 s/prop, lumpy; Stable Fast 3D not run): `handoff-log/2026-10-28-fast-3d-comparison.md`.
- Owed: Grayson to try the client live with the new shader (not yet seen on screen); `--demo` time-lapse and five-prop acceptance run (plan Task 8); whole-branch review; decide `lb-prompt-insides`. Windowless renders on Stealth (`gallery_check_stealth.sh`); Legion renders pop a window.

## ▶️ Next concrete step
**Image to blockout round 13:** r12 done (night shift 2026-10-29): boulder_r12b (taller upper-left hull) won 6-5, crate_r12a (thin rope end loops) won 6-5 narrowly; thick loops lost. Next: boulder surface fracture/overhang on the upper right, crate \"12\" in the triangle and lid lettering, then Grayson's own references or a new object class. Swamp residuals (paused): hut glow, log underside V12-13, mangrove canopy, knees mat (never enlarge).
- Alt: **image → blockout**: reference image → image-decomp → recipe picks/proportions → kiln scene → grade against the image with the same loop.
- Alt: package the loop as a Workflow script (needs Grayson's "use a workflow").

## ❓ Open questions
- Confirm the target look (Kenney clarity + Quaternius gesture) or supply refs. Inbox row filed.
- Keep smoothing on stone? Recommendation: stone back to flat (keep bevel); smoothing opt-in for organics only.
- Image-to-3D: also try ML image-to-mesh (TRELLIS / Hunyuan3D class) as a comparison, or stay code-only?

## 🗂️ Changed this session
- Branch `claude/self-improving-design-loop-3215de` → `grayson` · `src/core/prims.ts`, `project.ts` (tube `top`), `lib/grayson/{nature,styles}.kx.js`, `smoke/swamp.kx.js`, `lib/grayson/{values,ab}.py`, `golden.sh` + goldens, `docs/DESIGN-LOOP.md`; skill `text-to-glb` (Skills-Private) steps 4-5 + round 12 lessons.
- r8-r11 decisions: added fractured masses beat planar trimming; crate "yellow" was lid value, not hue; colour variation inside a face beats per-face tints; measure render S/V vs the ref before judging; a judge request (wide right lobe) can lose when built; removing a foreign part wins as much as fixing it; ties and half-point margins with reasons naming identical traits keep the champion.
- img2blockout decisions: decomposition is image-only; judge vs the kept build with the reference beside it; judge copies on the reference's backdrop; hull for rocks not foliage; colour from a lower percentile (median reads light).
- r5 decisions: isolate a visual artifact's cause before building the asked fix (seam = per-triangle lighting in the preview); adjacency, not lightness; split judges keep the champion.
- r3-r4 decisions: judge against the champion, not just the last round; the blind judge outranks critic rules (two palette lifts for a value floor lost: widen dark/light gaps by lightening lights); identity beats proportion advice (tapered knees beat bulbous); colour on a shape's own faces (`cap`) beats shells.
- r2 decisions: day preview mood for kits (night preview judged lit pieces in other light); woodD stays dark (lifting it lost post/plank separation); thin organics go wide in one direction, not thick in two (lint-thick moss read as pegs); hanging assets are built resting (previews seat on the lowest point).
- Decisions (+ why): fresh blind judge on shuffled pairs replaces "one grader per kit" (reused graders anchor; a fresh one has nothing to drift against); boardwalk stays level (modular piece must snap); toadstool stems: r1 kept the teal tint, r2 day mood shows them cream as the critic wanted; flare height = 7% of tree height (shorter reads as a plinth on small trees); no stacked near-coplanar layers (AO darkens them, engines z-fight).

---
📜 Full session history: `handoff-log/` (one dated file per session, oldest to newest)
