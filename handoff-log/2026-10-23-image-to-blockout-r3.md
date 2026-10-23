# 2026-10-23 — Image to blockout, round 3

- Grayson: hull/merge joining multi-mass objects, maple tall diagonal, a hard-surface Poly Haven CC0 reference, blind A/B vs kept, write back, push.
- Core `hull({ mat, cap, jitter... }, ...items)`: incremental convex hull in `mesh.ts`, a "hull" ref in `project.ts`; `cap` colouring factored into `capFaces()` for shapes and hulls. Test: two spheres -> one convex shape. Tests 23/23.
- Boulder v2 = two hulls (body; shoulder + slab) -> won 6-5 (one rock, not a pile). Maple v4 = hull core + lobes on a 45 deg diagonal -> lost 4-5 to v3 (mushroom cap) although IoU 0.65 -> 0.69 and aspect 1.22 -> 1.02.
- Hard surface: Poly Haven wine_barrel_01 (CC0, James Ray Cock). Decomp fitted a pinhole camera and a symmetrised radius profile, 6 hoop heights, 30 staves. v0 lathe IoU 0.80 -> v1 0.94, won 8-4 (best likeness yet). Residual: hoop contrast, judge reads it a bit squat.
