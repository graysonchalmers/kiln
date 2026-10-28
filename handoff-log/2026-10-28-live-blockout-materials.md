# Live Blockout materials + shader pass (2026-10-28, branch lb-materials)

Server: `materials.py` tags per palette key, `eval_materials` in `ladder.py`, `grid.materials` in every stage event (backward compatible);
stage prompt now offers `mat:`. Client: `voxel_sweep.gdshader` fragment rewritten (all six transition styles and the glow untouched):
per-brick jitter, loom stone/wood/metal/cloth detail (Texture2DArray, built in `voxel_view.gd`), seam AO + bevel, rim, glass fresnel,
emissive self-light. Per-tag table at the top of the shader. Lighting unchanged. 52 server tests green; Stealth gallery baseline refreshed
(before/after in `.proof/20261028-materials/`, not committed). Not done: per-material key/fill tints (skipped, not needed); Legion baseline
`gallery.png` NOT refreshed (no Legion renders allowed); next Legion run will need `gallery_check.sh --update`. Colour inference is a guess:
real model output with `mat:` should be spot-checked.
