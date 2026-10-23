# 2026-10-23 — Image to blockout, round 5

- Grayson: subtract/cut op in core used for the boulder crack, barrel hoops at the sampled iron value, crate colour from the sampled shadow tone + hasp straps; blind A/B vs kept, write back, push.
- Core `subtract(base, ...cutters)`: BSP CSG port in `src/core/csg.ts`; test 2 m cube minus corner = 7.875 m3, miss = unchanged. Tests 24/24.
- Boulder v4 (one hull + cut crack; a step cutter placed wrong first: box origin is base centre) lost 5-6 to v2.
- Barrel v3: measured hoop/wood value (ref hoop 30 / wood 35; v1 24/25, v2 34/25) and matched to 30/35; lost 7-8 (wood orange).
- Crate: measured v1 darker than ref (V 26 vs 40) against the judge's "too light". Built v2 (median-matched) and v2s (shadow tones, as asked) with hasp straps: v2 won 7-6, v2s tied. Crate v3 (straps + v1 olive) lost 5-6 to v2. Colour calls contradicted each other across judges: backdrop bias.
