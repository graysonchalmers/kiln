# 🧭 Session Handoff — Tool-Blockout3D (text / image → 3D blockout generator)

_Last updated: 2026-10-23 (Envy): image to blockout, round 4._

## 🎯 Current state
Text / image → 3D blockout generator on a fork of `uilianks/kiln` (MIT, low-poly assets as code → GLB). Origin = `graysonchalmers/kiln`, work on branch **`grayson`**; `main` mirrors upstream, no upstream PR planned.
- **Goal (Grayson, 2026-10-22):** text → blockout AND reference image → blockout, with a guaranteed quality floor, then into any engine.
- **Self-improving design loop exists now:** `docs/DESIGN-LOOP.md`. Steps: refs + 6-point bar → blind lens critics (form / color / construction) → written adjudication the critics argue back on → fix (scene, recipe or core) → fresh blind judge on per-asset shuffled pairs (`lib/grayson/ab.py`) → lessons into recipes + `text-to-glb` skill + goldens. Value tests: `lib/grayson/values.py <out>`.
- **Rounds so far (swamp):** r1 17/17. r2 9-4-3. r3 6-5-4 and lost the kit sheet (reverted). r4 beat r3 (9-2) and r2 (10 of 14 + kit sheet). r5 lost 6-3 first, kept its winners: kit sheet vs r4 after = current champion. Core: `tube` `top`/per-point radii, `rock({ flat })`, `settings({ mood })`, `cap`/`capAngle`, `blades({ bend })`, preview lights per corner (no seam); `trunk()` one mesh, branches upturn. Lint clean.
- **Image to blockout (2026-10-23):** `docs/IMAGE-TO-BLOCKOUT.md`, `lib/grayson/shot.ts` (matched camera), `lib/grayson/likeness.py` (silhouette IoU/aspect/hue). Kept (pack `img2blockout_best` in `smoke/img2blockout.kx.js`): broadleaf v2, pine v1, maple v5, boulder v2, barrel v1 (8/10, IoU 0.94), crate v1 (7/10, IoU 0.93). Core/recipes: `hull()`, `leaf({ angle })`, `canopy({ merge })`.
- **Target look (provisional, Grayson to confirm):** Kenney Nature Kit clarity + Quaternius Stylized Nature gesture, swamp palette.
- Gate: `npm run check` (18/18) + `lib/grayson/golden.sh check` (12/12, repo-relative paths) + `node bin/kiln.js lint <scene>` (swamp clean) + `lib/grayson/values.py <out>` (worst of hero/front/right).

## 📌 Where we stopped
Image to blockout round 4 merged to `grayson`. Proofs (gitignored, Envy): `.proof/2026-10-23-img2blockout/r4/round4.png` plus earlier rounds. Swamp rounds paused at r5. Target-look Inbox row still open.

## ▶️ Next concrete step
**Image to blockout round 5:** a subtract/cut op in core (cracks, notches, recessed panels; the boulder crack lost as an added box), barrel hoops at the sampled iron value, crate colour from the sampled shadow tone + hasp straps. Or Grayson's own references. Swamp residuals (paused): hut glow, log underside V12-13, mangrove canopy, knees mat (never enlarge).
- Alt: **image → blockout**: reference image → image-decomp → recipe picks/proportions → kiln scene → grade against the image with the same loop.
- Alt: package the loop as a Workflow script (needs Grayson's "use a workflow").

## ❓ Open questions
- Confirm the target look (Kenney clarity + Quaternius gesture) or supply refs. Inbox row filed.
- Keep smoothing on stone? Recommendation: stone back to flat (keep bevel); smoothing opt-in for organics only.
- Image-to-3D: also try ML image-to-mesh (TRELLIS / Hunyuan3D class) as a comparison, or stay code-only?

## 🗂️ Changed this session
- Branch `claude/self-improving-design-loop-3215de` → `grayson` · `src/core/prims.ts`, `project.ts` (tube `top`), `lib/grayson/{nature,styles}.kx.js`, `smoke/swamp.kx.js`, `lib/grayson/{values,ab}.py`, `golden.sh` + goldens, `docs/DESIGN-LOOP.md`; skill `text-to-glb` (Skills-Private) steps 4-5 + round 12 lessons.
- r5 decisions: isolate a visual artifact's cause before building the asked fix (seam = per-triangle lighting in the preview); adjacency, not lightness; split judges keep the champion.
- r3-r4 decisions: judge against the champion, not just the last round; the blind judge outranks critic rules (two palette lifts for a value floor lost: widen dark/light gaps by lightening lights); identity beats proportion advice (tapered knees beat bulbous); colour on a shape's own faces (`cap`) beats shells.
- r2 decisions: day preview mood for kits (night preview judged lit pieces in other light); woodD stays dark (lifting it lost post/plank separation); thin organics go wide in one direction, not thick in two (lint-thick moss read as pegs); hanging assets are built resting (previews seat on the lowest point).
- Decisions (+ why): fresh blind judge on shuffled pairs replaces "one grader per kit" (reused graders anchor; a fresh one has nothing to drift against); boardwalk stays level (modular piece must snap); toadstool stems: r1 kept the teal tint, r2 day mood shows them cream as the critic wanted; flare height = 7% of tree height (shorter reads as a plinth on small trees); no stacked near-coplanar layers (AO darkens them, engines z-fight).

---
📜 Full session history: `handoff-log/` (one dated file per session, oldest to newest)
