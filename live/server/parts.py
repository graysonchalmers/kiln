"""Part-list compiler: the model writes a short list of primitives instead of math, numpy turns it into the 64^3 master volume.
Nothing the model wrote is executed. Connectivity comes from `attach`, symmetry from `mirror`, and thin parts get a minimum thickness.

Line format (fields split by '|'; the list ends with a line `end`):
    name | shape | cu,cv,cw | su,sv,sw | key | attach | mirror | smooth
shape   box, cylinder, cone, ellipsoid, capsule, torus; cylinder/cone/capsule/torus have their axis along v (up);
        add -x or -z for an axis along u or w (cylinder-x). cone: apex up. torus: a flat ring, su=sw=outer width, sv=tube thickness.
centre  middle of the part; size = full extent along u (left-right), v (up), w (back-front); all in the unit cube 0..1.
attach  `-`, a part defined earlier, or `ground`. The part slides straight toward that part (or down to v=0) until it overlaps it.
mirror  `-`, x (copy at 1-u), z (copy at 1-w) or xz (three copies).
smooth  `smooth` blends the part into the other smooth parts (organic bodies); `-` or empty = hard edges. Smooth parts are painted
        first as the body, hard parts on top in list order (later parts win where they overlap).
"""
import numpy as np

from ladder import MASTER_N, LadderError

MIN_THICK = 0.05      # a part thinner than this (in any direction) is thickened to it: about 3 master voxels, 1.6 cells at 32
MAX_PARTS = 48
SMOOTH_K = 0.07       # blend radius of the smooth union, in box units
SHAPES = ("box", "cylinder", "cone", "ellipsoid", "capsule", "torus")
_AXES = {"": (0, 1, 2), "-x": (1, 0, 2), "-z": (0, 2, 1)}  # local (a, axis, b) -> indices into (u, v, w)
_CENTRES = (np.arange(MASTER_N) + 0.5) / MASTER_N


def _num3(text: str, what: str, line: int) -> tuple[float, float, float]:
    try:
        v = [float(t) for t in text.replace(" ", "").split(",") if t != ""]
    except ValueError:
        v = []
    if len(v) != 3 or any(abs(x) > 4 for x in v):
        raise LadderError("bad_plan", f"line {line}: {what} needs three numbers like 0.5,0.3,0.5 (got '{text.strip()}')")
    return v[0], v[1], v[2]


def parse_parts(text: str) -> list[dict]:
    """Part dicts from the part-list text; LadderError('bad_plan') names the line that is wrong."""
    parts, names = [], set()
    for i, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.lower() == "end" or line.startswith(("pal(", "#", "//", "```", "parts")):
            continue
        f = [s.strip() for s in line.split("|")]
        if len(f) < 5:
            raise LadderError("bad_plan", f"line {i}: need name | shape | centre | size | key (got {len(f)} fields)")
        name, shape, centre, size, key = f[:5]
        extra = f[5:] + [""] * 3
        base, _, ax = shape.lower().partition("-")
        ax = "-" + ax if ax else ""
        if base not in SHAPES or ax not in _AXES:
            raise LadderError("bad_plan", f"line {i}: shape '{shape}' must be one of {', '.join(SHAPES)} (cylinder-x / cylinder-z lie on their side)")
        if len(key) != 1 or key == ".":
            raise LadderError("bad_plan", f"line {i}: key '{key}' must be a single palette character")
        attach, mirror, smooth = extra[0] or "-", (extra[1] or "-").lower(), (extra[2] or "-").lower()
        if attach not in ("-", "ground") and attach not in names:
            raise LadderError("bad_plan", f"line {i}: attach target '{attach}' is not a part defined earlier")
        if mirror not in ("-", "x", "z", "xz"):
            raise LadderError("bad_plan", f"line {i}: mirror must be -, x, z or xz")
        c = _num3(centre, "centre", i)
        s = _num3(size, "size", i)
        if any(v <= 0 for v in s):
            raise LadderError("bad_plan", f"line {i}: size must be positive")
        parts.append({"name": name, "shape": base, "axis": ax, "centre": c, "size": s, "key": key, "attach": attach, "mirror": mirror,
                      "smooth": smooth.startswith("smooth")})
        names.add(name)
        if len(parts) > MAX_PARTS:
            raise LadderError("bad_plan", f"more than {MAX_PARTS} parts: merge or drop the small ones")
    if not parts:
        raise LadderError("bad_plan", "the part list is empty")
    return parts


def _sdf(shape: str, axis: str, size, rel) -> np.ndarray:
    """Approximate signed distance (box units; negative inside) of a primitive at offsets rel=(du,dv,dw) from its centre."""
    s = [max(v, MIN_THICK) for v in size]
    a, ax, b = _AXES[axis]
    # local frame: p0, p1 (the axis), p2 with half sizes h0, h1, h2
    p0, p1, p2 = rel[a], rel[ax], rel[b]
    h0, h1, h2 = s[a] / 2, s[ax] / 2, s[b] / 2
    if shape == "box":
        q = [np.abs(rel[i]) - s[i] / 2 for i in range(3)]
        return np.sqrt(sum(np.maximum(v, 0) ** 2 for v in q)) + np.minimum(np.maximum(np.maximum(q[0], q[1]), q[2]), 0)
    if shape == "ellipsoid":
        k0 = np.sqrt((rel[0] / (s[0] / 2)) ** 2 + (rel[1] / (s[1] / 2)) ** 2 + (rel[2] / (s[2] / 2)) ** 2)
        k1 = np.sqrt((rel[0] / (s[0] / 2) ** 2) ** 2 + (rel[1] / (s[1] / 2) ** 2) ** 2 + (rel[2] / (s[2] / 2) ** 2) ** 2)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
    rmin = min(h0, h2)
    r = np.sqrt((p0 / h0) ** 2 + (p2 / h2) ** 2)
    if shape == "cylinder":
        dr, dy = (r - 1) * rmin, np.abs(p1) - h1
    elif shape == "cone":
        t = np.clip((p1 + h1) / (2 * h1), 0, 1)
        dr, dy = (r - (1 - t)) * rmin * 0.8, np.abs(p1) - h1
    elif shape == "capsule":
        c = np.clip(p1, -(h1 - rmin), h1 - rmin) if h1 > rmin else 0 * p1
        return (np.sqrt((p0 / h0) ** 2 + ((p1 - c) / rmin) ** 2 + (p2 / h2) ** 2) - 1) * rmin
    else:  # torus
        rt = min(h1, min(h0, h2) * 0.9)
        big = max(h0, h2) - rt
        ring = np.sqrt(p0 ** 2 + (p2 * h0 / h2) ** 2)
        return np.sqrt((ring - big) ** 2 + p1 ** 2) - rt
    return np.minimum(np.maximum(dr, dy), 0) + np.sqrt(np.maximum(dr, 0) ** 2 + np.maximum(dy, 0) ** 2)


def _field(part: dict, centre) -> tuple[tuple, np.ndarray]:
    """(slices into the 64^3 volume (y, z, x), sdf over that crop) for a part at `centre` (u, v, w); the crop is its bounding box."""
    reach = [max(v, MIN_THICK) / 2 + SMOOTH_K * 1.5 for v in part["size"]]
    sl, ax = [], []
    for c, r in zip(centre, reach):
        lo = int(np.clip(np.floor((c - r) * MASTER_N), 0, MASTER_N))
        hi = int(np.clip(np.ceil((c + r) * MASTER_N), 0, MASTER_N))
        sl.append(slice(lo, max(hi, lo)))
        ax.append(_CENTRES[sl[-1]] - c)
    if any(a.size == 0 for a in ax):
        return (slice(0, 0),) * 3, np.zeros((0, 0, 0))
    u, v, w = ax
    rel = (u[None, None, :], v[:, None, None], w[None, :, None])  # volume axes are (y, z, x)
    d = _sdf(part["shape"], part["axis"], part["size"], rel)
    return (sl[1], sl[2], sl[0]), d


def _mask(part: dict, centre) -> tuple[tuple, np.ndarray]:
    sl, d = _field(part, centre)
    return sl, d < 0


def _full(sl, m: np.ndarray) -> np.ndarray:
    out = np.zeros((MASTER_N,) * 3, dtype=bool)
    out[sl] = m
    return out


def _snap(part: dict, parent: np.ndarray | None) -> tuple[tuple, str]:
    """The part's centre after attach: toward `parent` (a bool volume) until they overlap, plus a little more for a firm contact."""
    c = np.array(part["centre"], dtype=float)
    if part["attach"] == "ground":
        sl, m = _mask(part, c)
        ys = np.nonzero(m.any(axis=(1, 2)))[0]
        if ys.size:  # shift down so the lowest voxel row is row 0
            c[1] -= ys.min() / MASTER_N
        return tuple(c), "ground"
    if parent is None or not parent.any():
        return tuple(c), "no-parent"
    idx = np.argwhere(parent)
    pc = (idx[:, 2].mean() + .5, idx[:, 0].mean() + .5, idx[:, 1].mean() + .5)  # (u, v, w) voxel centroid of the parent
    toward = np.array(pc) / MASTER_N - c
    dist = float(np.linalg.norm(toward))
    if dist < 1e-6:
        return tuple(c), "inside"
    step = toward / dist / MASTER_N
    for k in range(int(dist * MASTER_N) + 2):
        sl, m = _mask(part, c + step * k)
        if m.size and (m & parent[sl]).any():
            return tuple(c + step * (k + (1.5 if k else 0))), ("touching" if k == 0 else "snapped")
    return tuple(c), "missed"


def _smooth_min(a: np.ndarray, b: np.ndarray, k: float) -> np.ndarray:
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def _copies(part: dict, centre) -> list[tuple]:
    c = list(centre)
    m = part["mirror"]
    out = [tuple(c)]
    if "x" in m and abs(c[0] - .5) > .5 / MASTER_N:
        out.append((1 - c[0], c[1], c[2]))
    if "z" in m and abs(c[2] - .5) > .5 / MASTER_N:
        out.append((c[0], c[1], 1 - c[2]))
    if m == "xz" and abs(c[0] - .5) > .5 / MASTER_N and abs(c[2] - .5) > .5 / MASTER_N:
        out.append((1 - c[0], c[1], 1 - c[2]))
    return out


def compile_parts(parts: list[dict]) -> tuple[np.ndarray, dict]:
    """(master volume of keys with '.' empty, report {"snapped": [...], "missed": [...]}) from parsed parts."""
    vol = np.full((MASTER_N,) * 3, ".", dtype="<U1")
    report = {"snapped": [], "missed": []}
    masks: dict[str, np.ndarray] = {}  # name -> bool volume, mirror copies included (what a later part can attach to)
    hard: list[tuple[dict, list]] = []
    smooth_fields: list[tuple[tuple, np.ndarray, str]] = []
    for p in parts:
        parent = masks.get(p["attach"]) if p["attach"] != "ground" else None
        centre, how = _snap(p, parent) if p["attach"] != "-" else (p["centre"], "")
        if how in ("missed", "no-parent"):
            report["missed"].append(p["name"])
        elif how in ("snapped", "ground"):
            report["snapped"].append(p["name"])
        total = np.zeros((MASTER_N,) * 3, dtype=bool)
        copies = []
        for c in _copies(p, centre):
            sl, d = _field(p, c)
            total |= _full(sl, d < 0)
            copies.append((sl, d))
        masks[p["name"]] = total
        if p["smooth"]:
            smooth_fields += [(sl, d, p["key"]) for sl, d in copies]
        else:
            hard.append((p, copies))
    if smooth_fields:  # the blended body: smooth union of every smooth part, key of the nearest part
        best = np.full((MASTER_N,) * 3, 9.0, dtype=np.float32)
        union = np.full((MASTER_N,) * 3, 9.0, dtype=np.float32)
        label = np.full((MASTER_N,) * 3, ".", dtype="<U1")
        for sl, d, key in smooth_fields:
            if d.size == 0:
                continue
            new_union = _smooth_min(union[sl], d.astype(np.float32), SMOOTH_K)
            nearer = d < best[sl]
            label[sl] = np.where(nearer, key, label[sl])
            best[sl] = np.minimum(best[sl], d)
            union[sl] = new_union
        vol[union < 0] = label[union < 0]
    for p, copies in hard:
        for sl, d in copies:
            if d.size:
                vol[sl][d < 0] = p["key"]
    return vol, report
