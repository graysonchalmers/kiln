# 2026-10-23 — Image to blockout, round 1 (three CC0 trees)

- Grayson: pause swamp rounds; image -> blockout with the same loop. Refs cropped from the Quaternius Stylized Nature sheet (CC0): broadleaf, pine, red maple.
- Tools: `lib/grayson/shot.ts` (one view at yaw/pitch, no ground; Blender not installed), `lib/grayson/likeness.py` (saturated-pixel ref mask vs per-row-backdrop render mask, fitted bottom-aligned, IoU + aspect + hue; `--cut-top` for cropped refs). First render mask included the gradient backdrop -> per-row background.
- 3 image-decomp subagents returned measured specs. v0 (naive) IoU 0.61/0.63/0.49 -> v1 0.67/0.73/0.57. Likeness judge v1: broadleaf 5, pine 7, maple 3, with spatial fixes. v2 from those: 0.72/0.70/0.63. Blind A/B v1 vs v2 with the reference: broadleaf v2 7-4, pine v1 6-4 (v2 over-drooped), maple v2 6-5 (v2 lost trunk + diagonal).
- Lessons: measure numeric fixes in the render; IoU misses gesture (aspect guard); fixes can erase other traits. Recipe gaps: merged canopy crown, leaf tip angle.
