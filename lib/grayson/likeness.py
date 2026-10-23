#!/usr/bin/env python3
"""Silhouette likeness between a reference image and a render: likeness.py <ref.png> <render.png> [--mask-out m.png]
Ref mask: saturated pixels (S > 0.22; the reference sits on a grey/white checker). Render mask: pixels away from the
render's background (estimated per row from the image edges: the backdrop is a gradient). Both cropped to their mask box, fitted into 128x128 (aspect kept), then compared.
--cut-top F drops the top F of the render's height (for a reference cropped by its frame).
Prints IoU (silhouette overlap), aspect (w/h) of each, and the dominant hue of each mask (degrees)."""
import subprocess, sys
import numpy as np

def load(f):
    w, h = map(int, subprocess.check_output(["identify", "-format", "%w %h", f + "[0]"]).split())
    return np.frombuffer(subprocess.check_output(["convert", f + "[0]", "-depth", "8", "rgb:-"]), np.uint8).reshape(h, w, 3).astype(float) / 255

def fit(m, n=128):
    ys, xs = np.nonzero(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape; s = n / max(h, w); H, W = max(1, round(h * s)), max(1, round(w * s))
    yi = (np.arange(H) / s).astype(int).clip(0, h - 1); xi = (np.arange(W) / s).astype(int).clip(0, w - 1)
    out = np.zeros((n, n), bool); oy, ox = n - H, (n - W) // 2  # bottom-aligned (trees stand on the ground), centred
    out[oy:oy + H, ox:ox + W] = m[yi][:, xi]
    return out, w / h

def hue(img, m):
    r, g, b = img[m].T; mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    hh = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    keep = (mx - mn) / np.maximum(mx, 1e-9) > 0.2
    return int(np.bincount((hh[keep] // 15).astype(int), minlength=24).argmax() * 15 + 7) if keep.any() else -1

ref, ren = load(sys.argv[1]), load(sys.argv[2])
mx, mn = ref.max(2), ref.min(2); mref = (mx - mn) / np.maximum(mx, 1e-9) > 0.22
bg = np.concatenate([ren[:, :3], ren[:, -3:]], 1).mean(1, keepdims=True); mren = np.abs(ren - bg).max(2) > 0.06  # per-row bg (gradient)
if "--cut-top" in sys.argv:  # the reference is cropped at the top: drop the same fraction of the render's height
    f = float(sys.argv[sys.argv.index("--cut-top") + 1]); ys = np.nonzero(mren.any(1))[0]
    mren[: ys.min() + int((ys.max() - ys.min()) * f)] = False
a, ar = fit(mref); b, br = fit(mren)
iou = (a & b).sum() / max(1, (a | b).sum())
print(f"iou {iou:.3f}  aspect ref {ar:.2f} render {br:.2f}  hue ref {hue(ref, mref)} render {hue(ren, mren)}")
if "--mask-out" in sys.argv:
    o = sys.argv[sys.argv.index("--mask-out") + 1]; vis = np.zeros((128, 256, 3), np.uint8)
    vis[:, :128] = np.stack([a * 255] * 3, -1); vis[:, 128:] = np.stack([b * 255, a * 120, b * 0], -1)
    subprocess.run(["convert", "-size", "256x128", "-depth", "8", "rgb:-", o], input=vis.tobytes(), check=True)
