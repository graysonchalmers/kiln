# Design loop: generate, critique, argue, fix, judge blind, write back

One round turns a kit (or the tool itself) a notch better and leaves the lesson in the library, not in a chat.
First run: swamp kit, 2026-10-22 (round 1 below). Evidence lives in `.proof/<date>-<topic>/` (gitignored).

## Steps

1. **Baseline.** `node bin/kiln.js build <scene> --out <P>/baseline`, `lib/grayson/sheet.sh <P>/baseline 4`,
   `node bin/kiln.js lint <scene>`. Look at the sheet yourself first.
2. **Anchor.** 2-4 reference images of the target look in `<P>/refs/` (CC0 packs work: Kenney, Quaternius).
   Write `<P>/BAR.md`: target look in one line + 6 observable points. No refs = the loop optimizes the grader's taste.
3. **Critic panel.** One blind subagent per lens, in parallel, each seeing only refs + BAR + sheet + `_preview/*.png`:
   form (silhouette, gesture, proportion), color (value, hue, cohesion), construction (attachment, grounding, engine
   safety). Ask each for a per-asset 1-5 table, top 3 kit-wide fixes, and concrete numbers.
4. **Argue.** Write `<P>/ADJUDICATION.md`: every claim accepted / modified / rejected with the evidence you checked
   (images, pixels, a test build). Send it back to the critics: "push back in 8 lines; name the change most likely to
   be under-done and its minimum." Their minimums become pass tests.
5. **Fix** in the scene, the recipes (`lib/grayson/*.kx.js`) or core (`src/`) where the root cause is a tool limit.
   Measure value tests with `lib/grayson/values.py <P>/candidate`.
6. **Judge blind.** `lib/grayson/ab.py <P>/baseline <P>/candidate <P>/ab <outside>/key.json` (per-asset coin flip;
   key outside the judge's folder). A FRESH judge sees only `<P>/ab` and returns winner + margin + regressions per
   asset. Unblind with `ab.py --unblind key.json asset=X ...`. Fix only the regressions it names; say which changes
   came after judging.
7. **Write back.** Lessons into recipes, `text-to-glb` `references/what-good-looks-like.md` and SKILL.md; re-save
   goldens for assets that changed on purpose and won (`golden.sh save`), then `golden.sh check` + `npm run check`.

Why fresh critics: a grader reused across rounds anchors on earlier drafts; one that judges a shuffled pair has
nothing to drift against. (Replaces "one grader per kit" from the earlier text-to-glb loop.)

## Round 1: swamp kit (2026-10-22)

- Panel found: wood/bark darker than the floor (measured 16-23% value vs 24% floor), every organic stem a
  constant-width pipe, raw cones standing in for knees and stump rims, stacked roof sheets.
- Root cause under the form critique: `tube()` had one radius. Added `tube(..., { top })` (core) and rebuilt
  `trunk()` as a concave root flare blending into a tapered, bent tube.
- Argued: boardwalk sag rejected (modular piece must snap level); toadstool "cream stems" rejected after a no-light
  test showed the stems sit in cap shadow; critics added hard minimums (trunk >= 25% of canopy width, lit wood >= 35%).
- Blind A/B: after won 17/17 (14 swamp + 2 battle trees changed by the recipe + kit sheet), mean margin +1.4 / 2.
  Regressions it named (collar seam at flare, knees lost their taper) fixed after.
- Left for round 2: boulders pinch to a point underneath (needs a flat-bottom `rock()` option: the model is re-grounded
  so sinking does nothing); mangrove roots and moss strands still spindly; hut roof is one mass but plain; deck and
  branch undersides below 15% value.

## Round 2: swamp kit (2026-10-23)

- Asked: flat-bottom rocks, thicker mangrove/moss, lift dark undersides, clear 11 lint flags. Panel re-run fresh on the
  round-1 result; the colour critic noticed the lit assets' preview floor was darker than the rest.
- Root causes fixed in core: `rock({ flat })` (rocks sat on a point); `tube(path, [r0, r1, ...])` one radius per point
  (`trunk()` is one mesh, so the flare collar seam is gone); `settings({ mood: "day" })` (any model with a `light()`
  previewed at night, so the hut, lantern and toadstools were judged under different light from the kit).
- Blind A/B 1: after won 9, lost 4 (boardwalk, stump, lantern, log bridge), tied 3; kit sheet to after. The losses taught:
  lifting a dark structural swatch passes the value floor but kills post/plank separation; a lint-driven thickening
  (cypress hanging moss) read as pegs; my stump change buried its cut ring. Fixed; woodD back to dark.
- Targeted re-judge (6 changed assets + sheet): cypress and hut now win, boardwalk and log bridge tie, kit sheet after.
  Stump still lost (ring read as a lid) and was fixed after, not re-judged. Lantern loses on preview lighting only.
- Left for round 3: cattail blades need a bend (`blades()` recipe); moss as a colour on the rock's own faces (no
  separate shell); log and moss-branch undersides and one mangrove view under the value floor (`values.py` now takes the
  worst of hero/front/right); lantern needs a judged look under day light; thin poles (snag, mangrove stem).
