#!/usr/bin/env python3
"""Value meter for kiln previews: values.py <out_dir|preview.png> ...
Per model, worst of the hero/front/right views: floor value, warm wood/bark lit (p90) and shadow (p10), light stone lit (p90), as HSV value 0-100.
Pass (2026-10-22 swamp round 1): lit wood >= 35 and >= floor + 10, wood shadow >= 15, stone lit >= floor + 15."""
import glob, os, subprocess, sys
import numpy as np

def measure(f):
    """Worst case over the hero, front and right views (a hero-only reading missed posts failing side-on)."""
    w, h = map(int, subprocess.check_output(["identify", "-format", "%w %h", f]).split())
    views = [measure_view(f, g) for g in (f"{w // 2}x{h // 2 - 60}+0+60", f"{w // 2}x{h // 2 - 60}+{w // 2}+60", f"{w // 2}x{h // 2 - 60}+0+{h // 2}")]
    worst = lambda i: min((v[i] for v in views if v[i] is not None), default=None)
    return round(sum(v[0] for v in views) / 3), worst(1), worst(2), worst(3)

def measure_view(f, geo):
    raw = subprocess.check_output(["convert", f, "-crop", geo, "+repage", "-depth", "8", "rgb:-"])
    a = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(float) / 255
    mx, mn = a.max(1), a.min(1); V = mx * 100; S = (mx - mn) / np.maximum(mx, 1e-9) * 100
    r, g, b = a.T; hue = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    floor = np.median(V[(S < 15) & (V < 35)])
    pct = lambda m, q: round(float(np.percentile(V[m], q))) if m.sum() >= 200 else None
    wood, stone = (hue >= 10) & (hue <= 50) & (S >= 25), (S < 20) & (V > floor + 6)
    return round(float(floor)), pct(wood, 90), pct(wood, 10), pct(stone, 90)

# a directory means a kiln out dir: models only (packs have no models/<name>.glb), no animation strips
files = [a for a in sys.argv[1:] if not os.path.isdir(a)] + [p for a in sys.argv[1:] if os.path.isdir(a)
         for p in sorted(glob.glob(f"{a}/_preview/*.png")) if "." not in os.path.basename(p)[:-4] and os.path.exists(f"{a}/models/{os.path.basename(p)[:-4]}.glb")]
print(f"{'asset':18} floor  wood_lit  wood_shadow  stone_lit")
for f in files:
    fl, wl, ws, sl = measure(f)
    flag = " <- wood" if wl is not None and (wl < 35 or wl < fl + 10 or (ws or 0) < 15) else ""
    print(f"{os.path.basename(f)[:-4]:18} {fl:5}  {wl if wl is not None else '-':>8}  {ws if ws is not None else '-':>11}  {sl if sl is not None else '-':>9}{flag}")
