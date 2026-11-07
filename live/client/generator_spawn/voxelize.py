"""Voxelize a textured GLB into Live Blockout grids ({n, cells, palette, box_min, box_size}) at several resolutions."""
import json, sys
import numpy as np, trimesh
from scipy.spatial import cKDTree

src, out = sys.argv[1], sys.argv[2]
cool = "--cool" in sys.argv
s = trimesh.load(src)
geoms = s.dump() if hasattr(s, "dump") else [s]  # every part, in scene space
P, C = [], []
for g in geoms:
    if not isinstance(g, trimesh.Trimesh) or len(g.faces) == 0:
        continue
    k = max(2000, int(200000 * g.area / sum(x.area for x in geoms if isinstance(x, trimesh.Trimesh))))
    pts, fi = trimesh.sample.sample_surface(g, k)
    col = np.full((len(pts), 3), 150.0)
    v = g.visual
    mat = getattr(v, "material", None)
    tex = getattr(mat, "baseColorTexture", None) if mat is not None else None
    if tex is None and mat is not None and hasattr(mat, "image"):
        tex = mat.image
    if getattr(v, "uv", None) is not None and tex is not None:
        bary = trimesh.triangles.points_to_barycentric(g.triangles[fi], pts)
        uvs = (v.uv[g.faces[fi]] * bary[:, :, None]).sum(1)
        img = np.asarray(tex.convert("RGB")); H, W = img.shape[:2]
        px = ((uvs[:, 0] % 1) * (W - 1)).astype(int); py = ((1 - uvs[:, 1] % 1) * (H - 1)).astype(int)
        col = img[py, px].astype(float)
        f = getattr(mat, "baseColorFactor", None)
        if f is not None:
            col *= np.asarray(f[:3], float) / (255.0 if np.max(f) > 1 else 1.0)
    elif mat is not None and getattr(mat, "baseColorFactor", None) is not None:
        f = np.asarray(mat.baseColorFactor[:3], float); col[:] = f if f.max() > 1 else f * 255
    P.append(pts); C.append(col)
pts = np.concatenate(P); cols = np.concatenate(C)
m = trimesh.util.concatenate([x for x in geoms if isinstance(x, trimesh.Trimesh)])
lo, hi = m.bounds
size = (hi - lo).max() * 1.02
center = (lo + hi) / 2
box_min = center - size / 2
box_min[1] = lo[1] - 0.01 * size
keys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
grids = {}
for n in (4, 8, 16, 32):
    cell = size / n
    ijk = np.floor((pts - box_min) / cell).astype(int).clip(0, n - 1)
    flat = (ijk[:, 1] * n + ijk[:, 2]) * n + ijk[:, 0]
    filled = np.zeros(n ** 3, bool); filled[flat] = True
    # solid fill via mesh containment of cell centres
    ii = np.arange(n ** 3)
    c = box_min + cell * (np.stack([ii % n, ii // (n * n), (ii // n) % n], 1) + 0.5)
    try:
        filled |= m.contains(c)
    except Exception:
        pass
    acc = np.zeros((n ** 3, 3)); cnt = np.zeros(n ** 3)
    np.add.at(acc, flat, cols); np.add.at(cnt, flat, 1)
    has = cnt > 0
    mean = np.zeros((n ** 3, 3)); mean[has] = acc[has] / cnt[has, None]
    # interior / unsampled filled cells take nearest sampled colour
    tree = cKDTree(np.nonzero(has)[0][:, None] * 0 + c[has])
    need = filled & ~has
    if need.any():
        _, j = tree.query(c[need]); mean[need] = mean[np.nonzero(has)[0][j]]
    # punch up: saturation x1.9, contrast x1.35 around mid-grey, slight lift so dark metal still reads
    g_ = mean.mean(1, keepdims=True)
    mean = np.clip((g_ + (mean - g_) * 1.9 - 110) * 1.35 + 125, 0, 255)
    if cool:
        mean = np.clip(mean * np.array([0.9, 0.97, 1.1]), 0, 255)
    # palette: k-means-ish quantize to <= 48 colours
    fc = mean[filled]
    q = (fc // 24).astype(int)
    uq, inv = np.unique(q, axis=0, return_inverse=True)
    pal_cols = np.array([fc[inv.ravel() == k].mean(0) for k in range(len(uq))])
    if len(pal_cols) > len(keys):
        order = np.argsort(-np.bincount(inv.ravel()))[: len(keys)]
        pal_cols = pal_cols[order]
    t2 = cKDTree(pal_cols)
    _, lab = t2.query(fc)
    cells = np.array(["."] * n ** 3, dtype="<U1")
    cells[np.nonzero(filled)[0]] = [keys[k] for k in lab]
    palette = {keys[k]: "#%02x%02x%02x" % tuple(int(v) for v in pal_cols[k]) for k in range(len(pal_cols))}
    grids[str(n)] = {"n": n, "cells": "".join(cells), "palette": palette}
    print(n, int(filled.sum()), len(palette))
json.dump({"box_min": box_min.tolist(), "box_size": [size] * 3, "grids": grids}, open(out, "w"))
