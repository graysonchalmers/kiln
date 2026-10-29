"""Three 24x24 text silhouettes (front, side, top) of a master volume, for the retry message: the model reads text, not pictures.
Each filled cell shows the key of the part nearest the viewer, so the model sees which part is where."""
import numpy as np

SIZE = 24


def _view(keys2d: np.ndarray) -> list[str]:
    """64x64 array of key chars ('.' empty), row 0 = top -> SIZE rows of SIZE chars (a cell is filled when 25% of its voxels are)."""
    n = keys2d.shape[0]
    edges = np.linspace(0, n, SIZE + 1).round().astype(int)
    rows = []
    for r in range(SIZE):
        line = ""
        for c in range(SIZE):
            block = keys2d[edges[r]:max(edges[r + 1], edges[r] + 1), edges[c]:max(edges[c + 1], edges[c] + 1)]
            solid = block[block != "."]
            if solid.size < 0.25 * block.size:
                line += "."
            else:
                ks, cnt = np.unique(solid, return_counts=True)
                line += ks[cnt.argmax()]
        rows.append(line)
    return rows


def _nearest(vol: np.ndarray, axis: int, from_end: bool) -> np.ndarray:
    """Key of the first occupied voxel along `axis` seen from the near end (or far end); '.' if the ray is empty."""
    a = np.moveaxis(vol, axis, 0)
    if from_end:
        a = a[::-1]
    occ = a != "."
    first = occ.argmax(axis=0)
    picked = np.take_along_axis(a, first[None], axis=0)[0]
    return np.where(occ.any(axis=0), picked, ".")


def silhouettes(vol: np.ndarray) -> str:
    """Text block: front (left to right = u, top = v=1), side (left = back, right = front), top (looking down: top row = back)."""
    front = _view(_nearest(vol, 1, True)[::-1])                      # axes (y, z, x): look along z from the front; flip y so top is up
    side = _view(_nearest(vol, 2, True)[::-1])                       # look along x from the right; columns are z (back to front)
    top = _view(_nearest(vol, 0, True))                              # look down along y; rows are z, columns x
    top = top[::-1]                                                  # back (z=0) at the top row
    blocks = [("FRONT (left to right = width, top = top of the box)", front),
              ("SIDE (left = back, right = front, top = top of the box)", side),
              ("TOP (looking down; top row = back, left to right = width)", top)]
    return "\n\n".join(f"{title}\n" + "\n".join(rows) for title, rows in blocks)
