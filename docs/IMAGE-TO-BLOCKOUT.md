# Image to blockout: reference image -> spec -> kiln scene -> graded against the image

The same discipline as `docs/DESIGN-LOOP.md` (nothing grades its own work, keep the best, write lessons back), pointed at
one reference image instead of a style bar. Evidence lives in `.proof/<date>-img2blockout/` (gitignored).
First run: three CC0 trees cropped from the Quaternius Stylized Nature sheet (broadleaf, pine, red maple), 2026-10-23.

## Tools
- `node lib/grayson/shot.ts <scene> <model> --yaw Y --pitch P --out x.png` renders one view with no ground, so the build
  can be shot at roughly the reference's camera (kiln `render` needs Blender; this uses the preview renderer).
- `python3 lib/grayson/likeness.py <ref.png> <render.png> [--cut-top F] [--mask-out m.png]` is the objective score:
  silhouette IoU after fitting both outlines into the same box (bottom-aligned), plus width/height and dominant hue.
  The reference mask is "saturated pixels" (it sits on a grey checker), the render mask is "away from the per-row
  backdrop". `--cut-top` crops the render like a reference whose top is cut by its frame.

## Steps
1. **Reference.** One object per image, clean background, colour that separates from it. Crop tight; note anything the
   frame cuts off.
2. **Decompose** (a subagent, `art-direction:image-decomp` for the craft read, then a measured spec): identity + 2-3
   recognition traits, a parts table in fractions of height (origin at the ground centre), proportions (width/height,
   widest point, lean, lopsidedness), a sampled palette, and the silhouette traits a judge checks first. Measured beats
   described: the subagent samples pixels.
3. **Floor.** Build the naive one-line recipe (v0) and score it. The loop has to beat this.
4. **Build v1** from the spec: recipes placed by the measured fractions, the sampled hexes as palette, shot at the
   reference's pitch. Score with `likeness.py`.
5. **Likeness judge** (fresh, blind to the code, told only which image is the reference): score 1-10 per build and the
   3 biggest differences with spatial fixes. Its list, not the builder's eye, drives v2.
6. **Build v2**, score, then a **blind A/B** (fresh judge, v1/v2 shuffled per tree, reference beside them). Keep the
   winner per tree; a loss keeps v1.
7. **Write back** recipe gaps and lessons (below, and the `text-to-glb` skill).

## Round 1 results (2026-10-23)

| Tree | v0 IoU | v1 IoU | v2 IoU | Likeness judge v1 | Blind A/B v1 vs v2 | Kept |
|---|---|---|---|---|---|---|
| broadleaf | 0.61 | 0.67 | 0.72 | 5/10 | v2 7 vs v1 4 | v2 |
| pine | 0.63 | 0.73 | 0.70 | 7/10 | v1 6 vs v2 4 | v1 |
| maple | 0.49 | 0.57 | 0.63 | 3/10 | v2 6 vs v1 5 (near tie) | v2 |

Scene: `smoke/img2blockout.kx.js`, pack `img2blockout_best`. The decomposed v1 beat the naive recipe on every tree
(+0.06 to +0.10 IoU, hue matched); the judge's fixes improved two of three.

## Lessons
- **Measure the spec, then build to it.** The decomposition's fractions (widest point 0.40H, lean +0.08H, trunk 0.18H)
  placed recipes better than any default; hue matched once the palette was sampled.
- **A numeric fix needs measuring in the build.** "Droop 20-30 deg" set by a guessed parameter turned the pine into a
  weeping tree and lost the A/B. Check the angle in the render before calling v2 done.
- **IoU alone misses gesture.** Maple v2 rose in IoU while its width/height drifted from 1.06 to 1.27 against 1.01 and
  the 45 deg diagonal and visible trunk were lost (the A/B was a near tie). Treat aspect drift away from the reference as
  a regression guard next to IoU.
- **A fix for one trait can erase another.** Merging the maple's lobes (asked) buried its trunk and flattened its lean
  (not asked to change). Re-read the spec's top traits after each fix.
- **Recipe gaps found:** `canopy()` lobes at spec size leave gaps (a merged-crown option or larger puff overlap would
  help); `leaf()` droop is relative to lift, so a target tip angle has no direct parameter; thin twigs trip `kiln lint`
  on small trees.
- **Next:** v3 for the maple (keep v2's mass, restore v1's trunk and diagonal) and the pine (v1 plus measured 20 deg
  droop); try a non-tree reference (a rock, a crate) to test the loop beyond `canopy`/`fronds`.
