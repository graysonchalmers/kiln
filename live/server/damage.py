"""Destroyed / burned versions of a pooled voxel level, from the same grid the intact prop uses.

Skin parts (staves, planks, cloth) break and burn first and char at their edges; structural parts (tag `structural` or
`metal`: hoops, frames, ribs, head battens) mostly survive, so a burnt barrel keeps its hoops and its inside stays visible.
Deterministic for a given seed; amount 0 returns the grid unchanged, 1 leaves only the sturdiest members.
"""
import numpy as np

CHAR, EMBER = "~", "^"                       # palette keys added by damage(); ordinary keys are letters/digits
CHAR_COLOR, EMBER_COLOR = "#1c1511", "#ff6a1a"
STURDY = ("structural", "metal")             # tags that survive damage better than skin


def _blur(a: np.ndarray, passes: int = 2) -> np.ndarray:
    for _ in range(passes):
        out = a.copy()
        for axis in range(3):
            out += np.roll(a, 1, axis) + np.roll(a, -1, axis)
        a = out / 7.0
    return a


def _dilate(m: np.ndarray, r: int) -> np.ndarray:
    out = m.copy()
    for _ in range(r):
        grown = out.copy()
        for axis in range(3):
            grown |= np.roll(out, 1, axis) | np.roll(out, -1, axis)
        out = grown
    return out


def damage(cells: np.ndarray, materials: dict[str, str], amount: float, seed: int = 0, mode: str = "burn"):
    """cells: (n,n,n) keys (y, z, x), '.' empty. Returns (cells, palette_extra, materials_extra).
    mode 'burn': fire climbs from the top and chars what it leaves; 'break': even, ragged breakage with no char."""
    n = cells.shape[0]
    amount = float(min(max(amount, 0.0), 1.0))
    solid = cells != "."
    if amount == 0.0 or not solid.any():
        return cells.copy(), {}, {}
    rng = np.random.default_rng(seed)
    noise = _blur(rng.random(cells.shape))
    noise = (noise - noise.min()) / max(float(noise.max() - noise.min()), 1e-9)
    height = np.linspace(0.0, 1.0, n)[:, None, None] * np.ones(cells.shape)
    score = noise * (0.55 if mode == "burn" else 1.0) + (height * 0.45 if mode == "burn" else 0.0)
    sturdy = np.isin(cells, [k for k, t in materials.items() if t in STURDY])
    gone = solid & (score > 1.0 - amount) & ~sturdy
    gone |= sturdy & (score > 1.0 - 0.3 * amount) & (noise > 0.8)          # a few members snap, most hold
    out = np.where(gone, ".", cells)
    alive = out != "."
    nb = sum(np.roll(alive, s, a) for a in range(3) for s in (1, -1))
    out = np.where(alive & (nb == 0), ".", out)                            # drop single floating voxels
    pal, mats = {}, {}
    if mode == "burn":
        alive = out != "."
        near = _dilate(gone, 2) & alive & ~sturdy
        out = np.where(near, CHAR, out)
        ember = _dilate(gone, 1) & alive & (out == CHAR) & (noise > 0.62)
        out = np.where(ember, EMBER, out)
        pal = {CHAR: CHAR_COLOR, EMBER: EMBER_COLOR}
        mats = {CHAR: "charred", EMBER: "emissive"}
    return out, pal, mats
