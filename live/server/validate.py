"""Checks on a sampled 64^3 master volume (axes y, z, x; keys, '.' empty). Each problem is {"code", "text"}: one plain sentence that
names the part, so it can go straight into a retry message. Sizes are fractions of the box (the unit cube), because that is what the
model writes in."""
import numpy as np

from ladder import AIR, master_runs
from repair import floating_pieces

MIN_HEIGHT = 0.6       # the prop must use at least this share of the box height
GROUND_GAP = 0.04      # the lowest solid voxel may start this far above v=0
THIN_RUN = 4           # voxels (64 master) = 1 cell at the 16 level. The spec said 2 cells (8), but that flags 91% of real grids (52/57); 4 flags 25%
THIN_MIN_VOXELS = 60   # smaller keys are details (a latch, an eye): too small to judge
FLOAT_CELLS = 96       # same size the repair uses: a separate piece under this is a speck
CODES = ("floating", "thin", "key_missing", "short", "ground")


def _frac(v: float) -> str:
    return f"{v:.2f}"


def _where(centre, n: int) -> str:
    y, z, x = (c / n for c in centre)
    parts = ["top" if y > 0.66 else "bottom" if y < 0.34 else "middle"]
    if abs(x - 0.5) > 0.2:
        parts.append("right" if x > 0.5 else "left")
    if abs(z - 0.5) > 0.2:
        parts.append("front" if z > 0.5 else "back")
    return " ".join(parts)


def _key_names(vol: np.ndarray, cells: list) -> str:
    idx = tuple(np.array(cells).T)
    ks, cnt = np.unique(vol[idx], return_counts=True)
    return "/".join(f"'{k}'" for k in ks[np.argsort(-cnt)][:2])


def validate(vol: np.ndarray, palette_keys=None) -> list[dict]:
    """All problems found, most important first. palette_keys: the keys pal({...}) defines (None skips that check)."""
    n = vol.shape[0]
    occ = vol != "."
    out: list[dict] = []
    main, pieces = floating_pieces(vol, FLOAT_CELLS)
    if len(main):
        m = np.array(main)
        sub = m[:: max(1, len(m) // 3000)]
        for comp in pieces:
            c = np.array(comp)
            d = np.sqrt(((c[:, None, :] - sub[None, :, :]) ** 2).sum(-1).min()) / n
            out.append({"code": "floating", "text": (
                f"The {_key_names(vol, comp)} piece at the {_where(c.mean(0), n)} of the box floats {_frac(d)} of the box away from "
                "the main body; every part must touch the body (overlap it a little).")})
    keys = sorted(set(np.unique(vol)) - {".", AIR})
    if palette_keys is not None:
        for k in sorted(set(palette_keys) - set(keys) - {AIR}):
            out.append({"code": "key_missing", "text": f"Palette key '{k}' never appears in the shape; use it or remove it."})
    if occ.any():
        ys = np.nonzero(occ.any(axis=(1, 2)))[0]
        top, bottom = (ys.max() + 1) / n, ys.min() / n
        if top - bottom < MIN_HEIGHT:
            out.append({"code": "short", "text": (
                f"The prop only fills {_frac(top - bottom)} of the box height (v {_frac(bottom)} to {_frac(top)}); "
                "scale it to fill the full height, v=0 to v=1.")})
        if bottom > GROUND_GAP:
            out.append({"code": "ground", "text": f"Nothing touches the ground: the lowest part starts at v={_frac(bottom)}; the base must start at v=0."})
    runs = master_runs(vol)
    for k in keys:
        sel = vol == k
        if sel.sum() < THIN_MIN_VOXELS:
            continue
        thick = np.percentile(runs[sel], 90)
        if thick < THIN_RUN:
            out.append({"code": "thin", "text": (
                f"The '{k}' parts are only {_frac(thick / n)} of the box thick; the 16-cell level needs at least {_frac(THIN_RUN / n)} "
                "or they vanish. Make them thicker, or drop them.")})
    return out


def score(problems: list[dict]) -> int:
    """Lower is better; a floating piece, a short prop or a missing ground contact costs more than a thin key or a stray palette key."""
    w = {"floating": 3, "ground": 3, "short": 3, "thin": 1, "key_missing": 1}
    return sum(w.get(p["code"], 1) for p in problems)
