# Image to blockout: reference image -> spec -> kiln scene -> graded against the image

The same discipline as `docs/DESIGN-LOOP.md` (nothing grades its own work, keep the best, write lessons back), pointed at
one reference image instead of a style bar. Evidence lives in `.proof/<date>-img2blockout/` (gitignored).
First run: three CC0 trees cropped from the Quaternius Stylized Nature sheet (broadleaf, pine, red maple), 2026-10-23.

## Tools
- `node lib/grayson/shot.ts <scene> <model> --yaw Y --pitch P --out x.png` renders one view with no ground, so the build
  can be shot at roughly the reference's camera (kiln `render` needs Blender; this uses the preview renderer).
- `shot.ts --bg "#f0f0f0"` renders on a solid backdrop: give judges builds on the reference's own backdrop.
- `python3 lib/grayson/likeness.py <ref.png> <render.png> [--cut-top F] [--mask-out m.png]` is the objective score:
  silhouette IoU after fitting both outlines into the same box (bottom-aligned), plus width/height and dominant hue.
  The reference mask is "saturated pixels" (it sits on a grey checker), the render mask is "away from the per-row
  backdrop". `--cut-top` crops the render like a reference whose top is cut by its frame.

## Steps
1. **Reference.** One object per image, clean background, colour that separates from it. Crop tight; note anything the
   frame cuts off.
2. **Decompose from the image only** (a subagent, `art-direction:image-decomp` for the craft read, then a measured
   spec; it must not fetch the source asset or mesh, or the loop stops testing image -> blockout): identity + 2-3
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

## Round 2 results (2026-10-23)

| Object | Kept before | New | IoU kept -> new | Blind A/B (likeness) | Kept now |
|---|---|---|---|---|---|
| maple | v2 | v3: v2's mass + v1's trunk, diagonal, red | 0.633 -> 0.647 | v3 4 vs 3 | v3 |
| pine | v1 | v3: v1 + boughs at a measured 20 deg | 0.725 -> 0.714 | tie 7-7 | v1 (champion) |
| boulder (Poly Haven boulder_01, CC0) | v0 naive rock | v1 from 6 fitted masses | 0.62 -> 0.75 | v1 6 vs 5 | v1 |

- Recipes: `leaf({ angle })` sets the drawn tip segment's angle (test: 19.8 deg for 20); `canopy({ merge })` grows and pulls
  puffs into one mass. `likeness.py` reads a transparent reference's alpha as its mask.
- Core fix found by building the kept pack: a pack's preview used the first model's palette, so models whose colours were
  defined later in the file failed. It now uses every model's palette (test with non-hex keys: `a`-`f` are default colours).
- Lessons: a measured 20 deg droop was too subtle to move a judge (tie), so "measure it" is necessary, not sufficient;
  `merge` fills one canopy but does not join separate lobes, so multi-lobe crowns still need overlapping sizes; a fitted-mass
  spec (union IoU 0.97 on the mask) built as separate rocks reads as a pile; the masses need joining (shared faces or one
  hull), not just placing.
- Next: a hull/merge for multi-mass objects (rock piles to one rock, lobes to one crown), the maple's tall diagonal (judge:
  ~0.85 w:h, build ~1.2), a hard-surface reference (crate, barrel).

## Round 3 results (2026-10-23)

| Object | Kept before | New | IoU kept -> new | Blind A/B (likeness) | Kept now |
|---|---|---|---|---|---|
| boulder | v1 (6 separate rocks) | v2: two `hull()`s (body; shoulder + slab) | 0.751 -> 0.756 | v2 6 vs 5 | v2 |
| maple | v3 | v4: hull core + lobes on a tall 45 deg diagonal | 0.647 -> 0.693 | v3 5 vs 4 | v3 |
| barrel (Poly Haven wine_barrel_01, CC0) | v0 naive lathe | v1: measured profile, 6 hoops, 30 staves, bung, recessed head | 0.796 -> 0.938 | v1 8 vs 4 | v1 |

- Core: `hull({ mat, cap, jitter... }, ...items)`, an incremental convex hull (test: two spheres join into one convex
  shape spanning both).
- Lessons: a hull turns a pile into one object (boulder), but on foliage it erases the clumps that identify it (maple v4
  "a mushroom cap"), even though IoU and aspect both improved: the judge read identity, the metric read area. Lathe-shaped
  hard-surface objects decompose almost exactly: a measured radius profile plus hoop heights gave IoU 0.94 and the best
  likeness so far (8/10).
- Next: barrel hoop contrast (wider, lighter metal); boulder plateau top and a crack instead of a clean seam; maple tall
  diagonal without losing clumps (hull only behind, lobes in front); a hard-surface box prop (crate) to test non-lathe parts.

## Round 4 results (2026-10-23)

| Object | Kept before | New | IoU kept -> new | Blind A/B (likeness) | Kept now |
|---|---|---|---|---|---|
| crate (Poly Haven old_military_crate, CC0) | v0 naive box | v1: lid, battens over skids, latches, corner posts, canvas flap | 0.807 -> 0.926 | v1 7 vs 3 | v1 |
| maple | v3 | v5: v3's clumps along v4's tall diagonal, scarlet | 0.647 -> 0.708 | v5 5 vs 4 | v5 |
| barrel | v1 | v2: hoops wider, prouder, lighter | 0.938 -> 0.910 | v1 8 vs 7 | v1 |
| boulder | v2 | v3: plateau mass, longer slab, a dark crack box | 0.756 -> 0.784 | v2 6 vs 5 | v2 |

- Box-built hard surface works: the image's rhythm (battens and skids at 19% / 81%, latches at 25% / 75%, the lid seam
  0.16H down) placed parts the judge counted one by one. Depth (0.56L) was an assumption, flagged. The naive crate's
  first score (0.60) was its wrong camera; shot at the measured camera it was 0.81, so always shoot v0 at the same camera.
- The crate's decomposition agent fetched the source mesh to check itself. Its mesh numbers were not used, and the step
  now says image only.
- A contrast fix must stay inside the reference's material: "lighter hoops" became silver and lost. Use the sampled iron
  value, not a direction.
- A crack is a cut, not an added part: a dark box in the seam read as a stick. kiln has no boolean subtract; that is the
  tool gap. The plateau mass also rounded the boulder's crown (it lost its craggy peak).
- Maple: keeping the clumps and moving them onto the diagonal won where the hull crown lost. Silhouette gesture and
  part identity both have to survive a fix.
- Next: subtract/cut (cracks, notches, recessed panels), barrel hoop value from the sample, crate colour from the sampled
  shadow tone (the render lightens it), crate hasp straps.

## Round 5 results (2026-10-23)

| Object | Kept before | New | Blind A/B (likeness) | Kept now |
|---|---|---|---|---|
| boulder | v2 (two hulls) | v4: one hull with the crack cut in by `subtract()` | v2 6 vs 5 | v2 |
| barrel | v1 | v3: hoop and wood values matched to the reference by measurement (hoop 30 / wood 35) | v1 8 vs 7 | v1 |
| crate | v1 | v2: hasp straps, colour matched to the reference medians | v2 7 vs 6 | v2 |
| crate | v1 | v2s: hasp straps, sampled shadow tones (as asked) | tie 6-6 | - |
| crate | v2 | v3: v2's straps in dark metal on v1's olive | v2 6 vs 5 | v2 |

- Core: `subtract(base, ...cutters)`, a BSP-tree boolean cut (after csg.js). Kept faces keep their material; carved walls
  take the cutter's (test: a 2 m cube minus a corner = 7.875 m3 exactly; a miss changes nothing).
- The cut works, but at blockout scale a crack thin enough to read as a crack reads as a faint crease: the judge preferred
  v2's separated lobe to one fused mass with a crack.
- Matching one measured value moves the others: lifting the barrel wood to the reference's value made it orange and
  saturated. Match hue, saturation and value together.
- Colour judging across backdrops is unreliable. Measured, crate v1 rendered darker than the reference (V 26 vs 40), the
  opposite of the judge's "too light"; a median-matched v2 then read "too pale khaki", and v1's olive read "brown" to the
  next judge. Builds are judged on a dark backdrop, references on light grey.
- Next: render the judge's copies on the reference's backdrop (a `shot.ts --bg` option), then redo colour; a deeper,
  wider crack cut on the two-hull boulder.

## Round 6 results (2026-10-23)

All pairs rendered on the reference's light-grey backdrop (`shot.ts --bg`).

| Object | Kept | New | Blind A/B (likeness) | Kept now |
|---|---|---|---|---|
| barrel | v1 | v4: wood and hoop colours with median H, S, V matched per material class | v1 7 vs 6 ("v4 saturated orange-tan") | v1 |
| crate | v2 | v4: same, plus the canvas lifted to its measured value | v2 7 vs 6 ("v4 canvas looks unpainted") | v2 |
| boulder | v2 | v5: v2 + a deep, wide crack cut into the body | v2 5.5 vs 5 (near tie) | v2 |

- With matched backdrops the colour verdicts became consistent, and they prefer the darker builds.
- Matching median H/S/V per class still loses: a photoreal reference carries dark seams, grime and shadow detail that a
  flat blockout lacks, so a flat colour at the reference's median reads lighter and warmer than the reference. Next: match
  a lower value percentile (or the mean including the dark detail), and judge flat colour against a blurred reference.
- A deeper crack moved about 590 pixels and the judge near-tied it; at blockout scale cracks matter less than mass.

## Loom textures (2026-10-25)

Kiln already consumed loom (`pal({ k: { tex, uv, bump, color } })`: box-projected UVs, albedo + ORM + GL normal embedded,
flat colour stays the default), so no core change. Materials: `lib/grayson/materials/assets.tx.js` (woodgrain,
woodgrain_v, painted, metal, canvas; all `seamless`), near-white detail maps tinted by each key's measured hex, the hex
lifted by the map's mean so the average colour holds. Loom stays external: `lib/grayson/materials/build.sh`
(`LOOM=<checkout>`); only the albedo/normal/ORM/manifest kiln reads are committed. Textured twins `<name>_t` share the
kept model's geometry (bodies wrapped as functions). GLBs pass glTF-Validator (0 errors; tangents generated).

| Object | Blind A/B flat vs textured (ref beside, `--bg #e6e6e6`) | Kept |
|---|---|---|
| barrel | textured 7 vs 6 (stave grain, worn hoops) | barrel_v1_t |
| crate | textured 7 vs 6 (plank grain, paint chips) | crate_v2_t |
| boulder | flat 6 vs 5 (crack decal read as cork/camouflage, flattened facets) | boulder_v2 |
| broadleaf, maple, pine | ties (bark/leaf mottling barely visible) | flat |

Lessons: grain must follow the part (box projection on a lathe put stripes across the staves until a rotated
`woodgrain_v`); decals with hard dark shapes fight low-poly facet shading; canopy puffs gain nothing from texture at
judging distance. The preview renderer shows albedo only, so the identity cue has to live in the albedo.
