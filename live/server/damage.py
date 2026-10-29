"""Destroyed / burned versions of a pooled voxel level, from the same grid the intact prop uses.

Skin parts (staves, planks, cloth) break and burn first and char at their edges; structural parts (tag `structural` or
`metal`: hoops, frames, ribs, head battens) mostly survive, so a burnt barrel keeps its hoops and its inside stays visible.
Parts that lose their support fall: anything not connected (face to face) to the ground layer drops until it rests on the
ground or on other cells, so a snapped hoop lands on the rim and a loose batten lands on the floor of the barrel.
Deterministic for a given seed; amount 0 returns the grid unchanged, 1 leaves only the sturdiest members.
"""
from collections import deque

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


def _supported(solid: np.ndarray, y0: int) -> np.ndarray:
    """Solid cells connected (6-neighbour) to the ground layer y0."""
    sup = np.zeros_like(solid)
    sup[y0] = solid[y0]
    while True:
        grown = sup.copy()
        for axis in range(3):
            for shift in (1, -1):
                nb = np.roll(sup, shift, axis)
                if axis == 0:  # np.roll wraps: do not let the top layer feed the bottom one
                    nb[0 if shift == 1 else -1] = False
                elif shift == 1:
                    nb[(slice(None),) * axis + (0,)] = False
                else:
                    nb[(slice(None),) * axis + (-1,)] = False
                grown |= nb & solid
        if (grown == sup).all():
            return sup
        sup = grown


def _components(mask: np.ndarray) -> list[list[tuple[int, int, int]]]:
    pts = {tuple(int(v) for v in c) for c in np.argwhere(mask)}
    comps = []
    while pts:
        start = pts.pop()
        comp, queue = [start], deque([start])
        while queue:
            y, z, x = queue.popleft()
            for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                q = (y + d[0], z + d[1], x + d[2])
                if q in pts:
                    pts.discard(q)
                    comp.append(q)
                    queue.append(q)
        comps.append(comp)
    return comps


def settle(cells: np.ndarray, y0: int = 0, max_rounds: int = 64) -> np.ndarray:
    """Let every part that is not connected to the ground layer y0 fall straight down until it rests. Returns a new array."""
    out = cells.copy()
    for _ in range(max_rounds):
        solid = out != "."
        floating = solid & ~_supported(solid, y0)
        if not floating.any():
            break
        moved = False
        for comp in sorted(_components(floating), key=lambda c: min(p[0] for p in c)):   # lowest parts first
            members = set(comp)
            drop = min(p[0] - y0 for p in comp)                                         # never below the ground layer
            for (y, z, x) in comp:
                k = 1
                while k <= drop and y - k >= y0 and not (out[y - k, z, x] != "." and (y - k, z, x) not in members):
                    k += 1
                drop = min(drop, k - 1)
            if drop <= 0:
                continue
            keys = [out[p] for p in comp]
            for p in comp:
                out[p] = "."
            for (y, z, x), k in zip(comp, keys):
                out[y - drop, z, x] = k
            moved = True
        if not moved:
            break
    return out


def damage(cells: np.ndarray, materials: dict[str, str], amount: float, seed: int = 0, mode: str = "burn", fall: bool = True):
    """cells: (n,n,n) keys (y, z, x), '.' empty. Returns (cells, palette_extra, materials_extra).
    mode 'burn': fire climbs from the top and chars what it leaves; 'break': even, ragged breakage with no char.
    fall: parts that lost their support drop (see settle)."""
    n = cells.shape[0]
    amount = float(min(max(amount, 0.0), 1.0))
    solid = cells != "."
    y0 = int(np.argwhere(solid)[:, 0].min()) if solid.any() else 0
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
    if fall:
        out = settle(out, y0)
    return out, pal, mats
