# 🧭 Session Handoff — Tool-Blockout3D (text / image → 3D blockout generator)

_Last updated: 2026-10-23 00:30 CT (Envy): design loop round 1 on the swamp kit._

## 🎯 Current state
Text / image → 3D blockout generator on a fork of `uilianks/kiln` (MIT, low-poly assets as code → GLB). Origin = `graysonchalmers/kiln`, work on branch **`grayson`**; `main` mirrors upstream, no upstream PR planned.
- **Goal (Grayson, 2026-10-22):** text → blockout AND reference image → blockout, with a guaranteed quality floor, then into any engine.
- **Self-improving design loop exists now:** `docs/DESIGN-LOOP.md`. Steps: refs + 6-point bar → blind lens critics (form / color / construction) → written adjudication the critics argue back on → fix (scene, recipe or core) → fresh blind judge on per-asset shuffled pairs (`lib/grayson/ab.py`) → lessons into recipes + `text-to-glb` skill + goldens. Value tests: `lib/grayson/values.py <out>`.
- **Round 1 result (swamp):** after won 17/17 blind (14 swamp + battle `old_oak`, `windswept_tree` + kit sheet), mean margin +1.4/2. Core: `tube(..., { top })` taper. Recipe: `trunk()` flares (`flare`) and tapers (`taper`). Swamp palette lifted (wood was darker than the floor).
- **Target look (provisional, Grayson to confirm):** Kenney Nature Kit clarity + Quaternius Stylized Nature gesture, swamp palette.
- Gate: `npm run check` (17/17) + `lib/grayson/golden.sh check` (12/12, paths now repo-relative so a worktree checks itself) + `node bin/kiln.js lint <scene>` (swamp: 11 flags left, was 20).

## 📌 Where we stopped
Round 1 merged to `grayson`. Grayson has not seen the result yet; proof `.proof/2026-10-22-swamp-loop/before_after_swamp.png` (gitignored, on the Envy).

## ▶️ Next concrete step
**Round 2 on the swamp kit** with the same loop: flat-bottom `rock()` option in core (boulders pinch to a point; the model is re-grounded so sinking does nothing), mangrove roots and moss strands still spindly, deck/branch undersides below 15% value, hut roof faces away from the key light (dark), 11 lint flags.
- Alt: **image → blockout**: reference image → image-decomp → recipe picks/proportions → kiln scene → grade against the image with the same loop.
- Alt: package the loop as a Workflow script (needs Grayson's "use a workflow").

## ❓ Open questions
- Confirm the target look (Kenney clarity + Quaternius gesture) or supply refs. Inbox row filed.
- Keep smoothing on stone? Recommendation: stone back to flat (keep bevel); smoothing opt-in for organics only.
- Image-to-3D: also try ML image-to-mesh (TRELLIS / Hunyuan3D class) as a comparison, or stay code-only?

## 🗂️ Changed this session
- Branch `claude/self-improving-design-loop-3215de` → `grayson` · `src/core/prims.ts`, `project.ts` (tube `top`), `lib/grayson/{nature,styles}.kx.js`, `smoke/swamp.kx.js`, `lib/grayson/{values,ab}.py`, `golden.sh` + goldens, `docs/DESIGN-LOOP.md`; skill `text-to-glb` (Skills-Private) steps 4-5 + round 12 lessons.
- Decisions (+ why): fresh blind judge on shuffled pairs replaces "one grader per kit" (reused graders anchor; a fresh one has nothing to drift against); boardwalk stays level (modular piece must snap); toadstool stems keep their teal tint (no-light test: stems sit in cap shadow); flare height = 7% of tree height (shorter reads as a plinth on small trees); no stacked near-coplanar layers (AO darkens them, engines z-fight).

---
📜 Full session history: `handoff-log/` (one dated file per session, oldest to newest)
