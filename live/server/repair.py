"""Fixes after the model has written a shape, before it is pooled into levels: a part that floats beside the body (a cork above its
neck, a cactus arm off the trunk, a head not touching a torso) is moved straight toward the body until it touches. Pieces that are
tiny are specks and get dropped; pieces that would have to move more than max_shift (a fraction of the grid) are left alone: that
is a design, not a gap."""
import numpy as np

from damage import _components


def floating_pieces(vol: np.ndarray, min_cells: int) -> tuple[list, list]:
    """(main body cells, [separate pieces with at least min_cells cells]) of a (n,n,n) volume of keys ('.' empty)."""
    comps = sorted(_components(vol != "."), key=len, reverse=True)
    if not comps:
        return [], []
    return comps[0], [c for c in comps[1:] if len(c) >= min_cells]


def bridge_floating(vol: np.ndarray, min_cells: int = 12, max_shift: float = 0.3, speck: int = 3) -> tuple[np.ndarray, dict]:
    """Returns (repaired copy, report). Each floating piece (not the biggest one) slides along the straight line to the closest
    cell of the main body until it touches; specks under `speck` cells are removed."""
    n = vol.shape[0]
    out = vol.copy()
    report = {"moved": [], "left": [], "specks": 0}
    for _ in range(4):  # a piece that lands on another floating piece may itself need moving
        comps = sorted(_components(out != "."), key=len, reverse=True)
        if len(comps) <= 1:
            break
        main = np.array(comps[0])
        changed = False
        for comp in comps[1:]:
            if len(comp) < speck:
                for p in comp:
                    out[p] = "."
                report["specks"] += 1
                changed = True
                continue
            if len(comp) < min_cells:
                continue
            c = np.array(comp)
            # the closest pair (piece cell, body cell); the main body is subsampled to keep this cheap
            m = main[:: max(1, len(main) // 3000)]
            d2 = ((c[:, None, :] - m[None, :, :]) ** 2).sum(-1)
            i, j = np.unravel_index(d2.argmin(), d2.shape)
            vec = (m[j] - c[i]).astype(float)
            dist = float(np.linalg.norm(vec))
            if dist > max_shift * n:
                report["left"].append({"cells": len(comp), "gap": round(dist, 1)})
                continue
            step = np.round(vec * (dist - 1.0) / dist).astype(int)  # along the line, stopping short of the body
            keys = [out[tuple(p)] for p in c]
            for p in c:
                out[tuple(p)] = "."
            moved = c + step
            body = set(map(tuple, main))
            for _ in range(4):  # finish with a face-to-face contact: a corner touch is not connected (6-neighbour rule)
                if any((q[0] + d[0], q[1] + d[1], q[2] + d[2]) in body for q in map(tuple, moved)
                       for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))):
                    break
                d2 = ((moved[:, None, :] - m[None, :, :]) ** 2).sum(-1)
                i, j = np.unravel_index(d2.argmin(), d2.shape)
                rest = m[j] - moved[i]
                axis = int(np.abs(rest).argmax())
                nudge = np.zeros(3, dtype=int)
                nudge[axis] = int(np.sign(rest[axis]))
                moved = moved + nudge
            for p, k in zip(moved, keys):
                q = tuple(int(v) for v in p)
                if all(0 <= v < n for v in q):
                    out[q] = k
            report["moved"].append({"cells": len(comp), "gap": round(dist, 1)})
            changed = True
        if not changed:
            break
    return out, report
