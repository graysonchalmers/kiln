# 🧭 Session Handoff — Tool-Kiln

_Last updated: 2026-10-22 (Envy), first session._

## 🎯 Current state
Grayson's text-to-blockout tool. Fork of `uilianks/kiln` (MIT, low-poly 3D assets as code → GLB). Origin = `graysonchalmers/kiln` (public; forks of public repos must be), upstream = `uilianks/kiln`, work on branch **`grayson`**; `main` mirrors upstream. Grayson is fine diverging from upstream (2026-10-22), so no upstream PR is planned.
- **Goal (Grayson, 2026-10-22):** text → blockout AND reference image → blockout, with a guaranteed quality floor, then drop the assets into any engine / 3D program. image-decomp / art-direction skills become the feedback loop that improves blockouts.
- **Core additions (src/):** `wobble` smooth noise, `DETAIL` / `--detail`, auto-smooth (`smooth`, `--smooth`), baked AO (`--ao`), bevel (`bevel`, `--bevel`, chamfered torus), `settings({ ao, smooth, bevel, looks, minor })`, per-material looks, `minor` parts, `kiln lint` (feature scale), stable shape-hashed seeds, viewer sliders (detail / smooth / AO / bevel).
- **Library (lib/grayson/):** `nature` (canopy, conifer, trunk, blades, leaf/fronds, fiddlehead, flame, mossRock, gravel, crystals), `props` (crate, sack, wheel, planks), `styles` (cozy/swamp/desert/autumn/winter + materialLooks), `detail` (S/SD/N/lods, wobble, feature/F), `sheet.sh`, `golden.sh` + 12 goldens.
- **Skill:** Skills-Private `text-to-glb` = this tool (kit mode, art-direction rules, review guide `references/what-good-looks-like.md`).
- Gate: `npm run check` (17/17) + `lib/grayson/golden.sh check` (12/12 ok).

## 📌 Where we stopped
Grayson judged the material-looks smoothing pass as little visible improvement (agreed: it changes shading, not silhouette; smooth stone reads as plastic). Proposed a different approach; he chose to wrap and resume next session.

## ▶️ Next concrete step
**Reference-anchored art direction (direction 1):** gather 2-3 target-look reference images (none exist locally; search for stylized low-poly prop kits / image-to-3D examples), run image-decomp + art-direction on them to produce concrete rules, and make the blind grader score against those references. Then add **image → blockout**: reference image → image-decomp → recipe picks/proportions → kiln scene → grade vs the image.
- Alt 2: build-from-pieces for stone/logs (stone well from individual stones, rock clusters): biggest form win, no references needed.
- Alt 3: better review renders (bigger hero, rim light) so edges/form read in sheets and for the grader.
- Then: Unity / engine drop-in (prefabs, `lods()` LOD groups, colliders), recipe gallery page.

## ❓ Open questions
- Which reference look? (Grayson to supply or approve candidates.)
- Keep smoothing on stone? Recommendation: stone back to flat (keep bevel); smoothing opt-in for organics only.
- Image-to-3D: also try ML image-to-mesh (TRELLIS / Hunyuan3D class) as a comparison or seed, or stay code-only (kiln DSL)?
- Moving the project from `z-Git/kiln` broke nothing tested, but old commons logs still mention `z-Git/kiln` (history, left as is).

## 🗂️ Changed this session
- Branch `grayson` · scenes `smoke/{suite,nature,nature_v2,battle,swamp,lod_demo,style_demo}.kx.js` · proofs in `.proof/` (gitignored).
- Decisions (+ why): one grader per kit (fresh graders re-calibrate; swamp r2 dip was grader change); no single hard-surface shape over ~1 m in two dims (build from boards); feature floor 2.5% of asset in two dims (`kiln lint`); seeds hash the shape, not the line (golden check caught line-number drift twice); bevel thin parts proportionally (Grayson review).

---
📜 Full session history: `handoff-log/` (one dated file per session, oldest to newest)
