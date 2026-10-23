# 🧭 Session Handoff — Tool-Blockout3D (text / image → 3D blockout generator)

_Last updated: 2026-10-23 (Envy): design loop round 2 on the swamp kit._

## 🎯 Current state
Text / image → 3D blockout generator on a fork of `uilianks/kiln` (MIT, low-poly assets as code → GLB). Origin = `graysonchalmers/kiln`, work on branch **`grayson`**; `main` mirrors upstream, no upstream PR planned.
- **Goal (Grayson, 2026-10-22):** text → blockout AND reference image → blockout, with a guaranteed quality floor, then into any engine.
- **Self-improving design loop exists now:** `docs/DESIGN-LOOP.md`. Steps: refs + 6-point bar → blind lens critics (form / color / construction) → written adjudication the critics argue back on → fix (scene, recipe or core) → fresh blind judge on per-asset shuffled pairs (`lib/grayson/ab.py`) → lessons into recipes + `text-to-glb` skill + goldens. Value tests: `lib/grayson/values.py <out>`.
- **Rounds so far (swamp):** r1 after won 17/17 blind. r2 after 9 / before 4 / tie 3 (kit sheet after), losses fixed and re-judged. Core added: `tube` `top` + per-point radii, `rock({ flat })`, `settings({ mood: "day" })` (kits with lit pieces). `trunk()` is one mesh (flare + taper). Lint clean.
- **Target look (provisional, Grayson to confirm):** Kenney Nature Kit clarity + Quaternius Stylized Nature gesture, swamp palette.
- Gate: `npm run check` (18/18) + `lib/grayson/golden.sh check` (12/12, repo-relative paths) + `node bin/kiln.js lint <scene>` (swamp clean) + `lib/grayson/values.py <out>` (worst of hero/front/right).

## 📌 Where we stopped
Round 2 merged to `grayson`. Proofs (gitignored, Envy): `.proof/2026-10-22-swamp-loop/before_after_swamp.png`, `.proof/2026-10-23-swamp-loop-r2/before_after_r2.png`. Target-look Inbox row still open.

## ▶️ Next concrete step
**Round 3 on the swamp kit:** bend cattail blades (`blades()` recipe), moss as colour on the rock's own faces (no shell), log/moss-branch undersides and one mangrove view under the value floor, lantern look under day light, thin poles (snag, mangrove stem).
- Alt: **image → blockout**: reference image → image-decomp → recipe picks/proportions → kiln scene → grade against the image with the same loop.
- Alt: package the loop as a Workflow script (needs Grayson's "use a workflow").

## ❓ Open questions
- Confirm the target look (Kenney clarity + Quaternius gesture) or supply refs. Inbox row filed.
- Keep smoothing on stone? Recommendation: stone back to flat (keep bevel); smoothing opt-in for organics only.
- Image-to-3D: also try ML image-to-mesh (TRELLIS / Hunyuan3D class) as a comparison, or stay code-only?

## 🗂️ Changed this session
- Branch `claude/self-improving-design-loop-3215de` → `grayson` · `src/core/prims.ts`, `project.ts` (tube `top`), `lib/grayson/{nature,styles}.kx.js`, `smoke/swamp.kx.js`, `lib/grayson/{values,ab}.py`, `golden.sh` + goldens, `docs/DESIGN-LOOP.md`; skill `text-to-glb` (Skills-Private) steps 4-5 + round 12 lessons.
- r2 decisions: day preview mood for kits (night preview judged lit pieces in other light); woodD stays dark (lifting it lost post/plank separation); thin organics go wide in one direction, not thick in two (lint-thick moss read as pegs); hanging assets are built resting (previews seat on the lowest point).
- Decisions (+ why): fresh blind judge on shuffled pairs replaces "one grader per kit" (reused graders anchor; a fresh one has nothing to drift against); boardwalk stays level (modular piece must snap); toadstool stems keep their teal tint (no-light test: stems sit in cap shadow); flare height = 7% of tree height (shorter reads as a plinth on small trees); no stacked near-coplanar layers (AO darkens them, engines z-fight).

---
📜 Full session history: `handoff-log/` (one dated file per session, oldest to newest)
