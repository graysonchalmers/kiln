# 🧭 Session Handoff — Tool-Blockout3D (text / image → 3D blockout generator)

_Last updated: 2026-10-23 (Envy): design loop rounds 3-4 on the swamp kit._

## 🎯 Current state
Text / image → 3D blockout generator on a fork of `uilianks/kiln` (MIT, low-poly assets as code → GLB). Origin = `graysonchalmers/kiln`, work on branch **`grayson`**; `main` mirrors upstream, no upstream PR planned.
- **Goal (Grayson, 2026-10-22):** text → blockout AND reference image → blockout, with a guaranteed quality floor, then into any engine.
- **Self-improving design loop exists now:** `docs/DESIGN-LOOP.md`. Steps: refs + 6-point bar → blind lens critics (form / color / construction) → written adjudication the critics argue back on → fix (scene, recipe or core) → fresh blind judge on per-asset shuffled pairs (`lib/grayson/ab.py`) → lessons into recipes + `text-to-glb` skill + goldens. Value tests: `lib/grayson/values.py <out>`.
- **Rounds so far (swamp):** r1 17/17. r2 9-4-3. r3 6-5-4 and lost the kit sheet (reverted). r4 beat r3 (9-2) and the r2 champion (10 of 14 + kit sheet) = current champion. Core: `tube` `top`/per-point radii, `rock({ flat })`, `settings({ mood })`, `cap`/`capAngle`, `blades({ bend })`; `trunk()` one mesh, branches upturn. Lint clean.
- **Target look (provisional, Grayson to confirm):** Kenney Nature Kit clarity + Quaternius Stylized Nature gesture, swamp palette.
- Gate: `npm run check` (18/18) + `lib/grayson/golden.sh check` (12/12, repo-relative paths) + `node bin/kiln.js lint <scene>` (swamp clean) + `lib/grayson/values.py <out>` (worst of hero/front/right).

## 📌 Where we stopped
Round 4 merged to `grayson`. Proofs (gitignored, Envy): `.proof/2026-10-23-swamp-loop-r4/before_after_r4.png` (r2 champion vs r4) plus earlier rounds. Target-look Inbox row still open.

## ▶️ Next concrete step
**Round 5 on the swamp kit:** core fix for the lantern-post diagonal seam (subdivide long faces before baking AO), cypress hanging moss that reads, mangrove canopy as 3-5 masses, log underside (V13). Judge against the r4 champion.
- Alt: **image → blockout**: reference image → image-decomp → recipe picks/proportions → kiln scene → grade against the image with the same loop.
- Alt: package the loop as a Workflow script (needs Grayson's "use a workflow").

## ❓ Open questions
- Confirm the target look (Kenney clarity + Quaternius gesture) or supply refs. Inbox row filed.
- Keep smoothing on stone? Recommendation: stone back to flat (keep bevel); smoothing opt-in for organics only.
- Image-to-3D: also try ML image-to-mesh (TRELLIS / Hunyuan3D class) as a comparison, or stay code-only?

## 🗂️ Changed this session
- Branch `claude/self-improving-design-loop-3215de` → `grayson` · `src/core/prims.ts`, `project.ts` (tube `top`), `lib/grayson/{nature,styles}.kx.js`, `smoke/swamp.kx.js`, `lib/grayson/{values,ab}.py`, `golden.sh` + goldens, `docs/DESIGN-LOOP.md`; skill `text-to-glb` (Skills-Private) steps 4-5 + round 12 lessons.
- r3-r4 decisions: judge against the champion, not just the last round; the blind judge outranks critic rules (two palette lifts for a value floor lost: widen dark/light gaps by lightening lights); identity beats proportion advice (tapered knees beat bulbous); colour on a shape's own faces (`cap`) beats shells.
- r2 decisions: day preview mood for kits (night preview judged lit pieces in other light); woodD stays dark (lifting it lost post/plank separation); thin organics go wide in one direction, not thick in two (lint-thick moss read as pegs); hanging assets are built resting (previews seat on the lowest point).
- Decisions (+ why): fresh blind judge on shuffled pairs replaces "one grader per kit" (reused graders anchor; a fresh one has nothing to drift against); boardwalk stays level (modular piece must snap); toadstool stems: r1 kept the teal tint, r2 day mood shows them cream as the critic wanted; flare height = 7% of tree height (shorter reads as a plinth on small trees); no stacked near-coplanar layers (AO darkens them, engines z-fight).

---
📜 Full session history: `handoff-log/` (one dated file per session, oldest to newest)
