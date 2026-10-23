# 2026-10-23 — Design loop round 2 (swamp kit)

- Grayson: "run round 2 ... flat-bottom rock(), thicker mangrove roots and moss, lift dark undersides, clear the 11 lint flags, then blind A/B and write-back".
- Fresh 3-lens panel on the r1 result. Colour critic measured per view and found the lit assets' preview floor darker: kiln previews any model with a `light()` at night. Form critic disputed facts I checked and rejected (cattail heads are lathes; branch is an 8-sided tube) and conceded on pushback; construction critic pushed the moss branch from "hanging" to a grounded design.
- Core: `rock({ flat })`, `tube` radius per point (one-mesh `trunk()`, no collar seam), `settings({ mood })` + `ViewOpts.mood`. Tests 17 -> 18.
- Assets: lint 11 -> 0; palette (bark/barkD/leafD up, AO 0.75 -> 0.55, stone neutral); snag thicker + third limb; mangrove arched tapered roots; cypress canopy thicker, moss as flat drapes; toadstools hero cap + mound, caps no longer clip (p90 96 -> 79); hut steeper roof, thicker stilts; moss branch rebuilt as fallen mossy branch; boulders flat seats.
- Blind A/B: after 9 / before 4 / tie 3, kit sheet after. Losses: boardwalk + log bridge (woodD lift erased post/plank separation), stump (I buried the cut ring), lantern (preview lighting). Fixed; targeted re-judge: cypress, hut win; boardwalk, log bridge tie; stump still lost -> fixed after (not re-judged).
- values.py now worst-of-three views; it flags log/moss-branch undersides and a mangrove view (round 3).
- Night gate: hut, lantern, toadstools checked under night mood, no clipping.
