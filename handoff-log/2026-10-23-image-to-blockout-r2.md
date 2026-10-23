# 2026-10-23 — Image to blockout, round 2

- Grayson: maple v3, pine with a measured 20 deg droop, leaf() tip angle, canopy() merge, a non-tree CC0 reference, blind A/B vs kept, write back, push.
- `leaf({ angle })`: first solve was off (tangent vs drawn chord, stray factor); solved for the last segment's chord, test 9.8/19.8/34.8 for 10/20/35. `canopy({ merge })`: fills one canopy, does not join separate lobes.
- Non-tree ref: Poly Haven boulder_01 (CC0, transparent thumbnail); likeness.py reads alpha. image-decomp fitted 6 masses (union IoU 0.966). v0 rock 0.62 -> v1 0.75.
- Blind A/B: maple v3 4-3 over v2; pine v3 7-7 tie (v1 kept); boulder v1 6-5 over v0 (reads as a pile).
- Core bug found building the kept pack: pack preview used the first model's palette; now the union. Test first passed on old code because `a`/`b` are default hex palette keys; renamed to non-hex keys, now fails old / passes new.
