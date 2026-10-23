# 2026-10-23 — Design loop round 5 (swamp kit)

- Grayson: core fix for the lantern seam (subdivide long faces before baking AO), cypress hanging moss, mangrove canopy 3-5 masses, log underside.
- Built the AO subdivision; the seam stayed (zigzag). Two-build check: AO off still seamed, no light no seam -> the preview lit model lights per triangle centroid. Fixed `render.ts` (per-corner, interpolated), test proves old 10 vs new 1 step. AO subdivision reverted (+80% tris cattails, no visible gain).
- Blind vs r4 champion: before 6, after 3, ties 5, kit sheet before. Reverted mangrove masses, lighter moss, knee mat, log woodD planks; raised lantern/hut lights. Re-judge: kit sheet after; cypress, knees, stump, lantern after; snag split -> champion's; hut before (bug glow).
- Log underside: odd-sided log did nothing; cast shadow. Residual.
