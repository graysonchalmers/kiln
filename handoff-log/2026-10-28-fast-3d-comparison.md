# Fast text/image-to-3D comparison for Live Blockout (2026-10-28)

Barrel, boulder, crate (references from the PropForge KILN vs TRELLIS.2 compare), five ways, one sheet:
reference, TripoSR, TRELLIS.2, KILN, Live Blockout. Sheet in `.proof/20261028-triposr/compare_all.png` (gitignored); copy at the Legion `Downloads\envy\compare_all.png`.

- **TripoSR** (Stealth 3060 Ti, res 256, torchmcubes shimmed with scikit-image, no nvcc): 2.3-2.4 s/prop, 2.5 GB VRAM, 28 s load, 91-187k raw tris. Right silhouette, lumpy surface, washed colour. Grayson: not a fan.
- **Stable Fast 3D**: not run. Gated on HF (token works), needs ~5.6 GB (OOM beside the voice servers) and a CUDA texture_baker (no nvcc on Stealth). Stopped on the parent session's instruction; do not stop the voice servers without Grayson's OK. Install left at Stealth `/data/apps/imgto3d/{sfvenv,sf3d_repo,bench_sf3d.py}`.
- **Live Blockout** (real server, 3 requests, 6-7 s each): barrel and boulder read; the crate came out a dark box (model variance, one run).
- Bug found by these real requests: the `mat:` stage-prompt tag was rejected by kiln's `pal()` (fixed, PR 2).
- Lessons: dry-run the exact script and imports before taking a GPU lease (two wasted leases); never `scp` over a file you just fixed on the remote; keep the clone folder name off the Python package name.

Next: Grayson wants to try other assets, not these three. Ideas: stylised props (where Live Blockout's look is the point), a second Live Blockout run per prop (best-of-2 for model variance), InstantMesh (ungated) if more fast image-to-3D is wanted.
