"""Resolution ladder: one model-written shape function f(u,v,w) becomes 4, 8, 16, 32 cell voxel levels (after the client's block).

f is sampled ONCE on a 64^3 master volume (in a node vm sandbox); every level is pooled from that master with one
rule, so a level never contains something a finer level lacks. Parts thinner than ~1.5 cells (measured
per material) are kept, and a thin minority material covering 2% of a cell wins its key, so poles, hoops and
windows survive the coarse levels.
"""
import json
import re
import subprocess

import numpy as np

from materials import infer_tag

LEVELS = (4, 8, 16, 32)  # the client draws the solid block itself, the instant Enter is pressed
AIR = "_"  # reserved key: deliberate interior air (a hollow barrel). solidify leaves it empty instead of filling it
MASTER_N = 64
FILL_FRACTION = 0.5   # a cell is solid when at least this share of its master voxels are occupied
FEATURE_SHARE = 0.02  # a thin minority material covering this share of a cell wins the cell's key
THIN_CELLS = 1.5      # a part thinner than this many cells (in its own material) is kept in every level

_EVAL_JS = r"""
const vm = require('vm');
let input = '';
process.stdin.on('data', d => input += d).on('end', () => {
  const { f_src, n, timeout } = JSON.parse(input);
  const ctx = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  const code = f_src + `
;(function(){const n=${n};const out=[];
for(let y=0;y<n;y++)for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const r=f((x+.5)/n,(y+.5)/n,(z+.5)/n);
  out.push(typeof r==='string'&&r.length===1&&r!=='.'&&r!==' '?r:'.');}
return out.join('');})()`;
  try { process.stdout.write(vm.runInContext(code, ctx, { timeout })); }
  catch (e) { process.stderr.write(String((e && e.message) || e)); process.exit(2); }
});
"""


_PALETTE_JS = r"""
const vm = require('vm');
let input = '';
process.stdin.on('data', d => input += d).on('end', () => {
  const { pal_src, timeout } = JSON.parse(input);
  const ctx = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  try { process.stdout.write(String(vm.runInContext('var __P=null;function pal(o){__P=o}\n' + pal_src + '\n;JSON.stringify(__P)', ctx, { timeout }))); }
  catch (e) { process.stdout.write('null'); }
});
"""


_CLEAN_JS = r"""
const vm = require('vm');
let input = '';
process.stdin.on('data', d => input += d).on('end', () => {
  const { pal_src, timeout } = JSON.parse(input);
  const ctx = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  try {
    const o = vm.runInContext('var __P=null;function pal(o){__P=o}\n' + pal_src + '\n;__P', ctx, { timeout });
    for (const v of Object.values(o)) if (v && typeof v === 'object') { delete v.mat; delete v.material; }
    process.stdout.write(JSON.stringify(o));
  } catch (e) { process.exit(2); }
});
"""


class LadderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code, self.message = code, message


def _match(s: str, start: int, open_ch: str, close_ch: str) -> int:
    """Index just past the bracket matching s[start] (string-aware), or -1."""
    depth, quote, esc = 0, None, False
    for i in range(start, len(s)):
        ch = s[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
        elif ch in "\"'`":
            quote = ch
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i + 1
    return -1


def parse_reply(text: str) -> tuple[str, str]:
    """(pal_src, f_src) from the model reply, tolerating fences and prose; LadderError('bad_reply') if incomplete."""
    text = "\n".join(l for l in text.splitlines() if not l.strip().startswith("```"))
    p = text.find("pal(")
    f = text.find("function f")
    if p < 0 or f < 0:
        raise LadderError("bad_reply", "reply needs pal({...}) and function f(u,v,w){...}")
    pe = _match(text, p + 3, "(", ")")
    fb = text.find("{", f)
    fe = _match(text, fb, "{", "}") if fb >= 0 else -1
    if pe < 0 or fe < 0:
        raise LadderError("bad_reply", "pal(...) or function f is not complete")
    return text[p:pe], text[f:fe]


def eval_master(pal_src: str, f_src: str, n: int = MASTER_N, timeout: float = 6.0) -> np.ndarray:
    """Sample f on an n^3 grid, axes (y, z, x); one character per voxel, '.' = empty."""
    try:
        r = subprocess.run(["node", "-e", _EVAL_JS], input=json.dumps({"f_src": f_src, "n": n, "timeout": int(timeout * 1000)}),
                           capture_output=True, text=True, timeout=timeout + 3)
    except subprocess.TimeoutExpired:
        raise LadderError("eval_error", "f took too long") from None
    if r.returncode != 0 or len(r.stdout) != n ** 3:
        raise LadderError("eval_error", (r.stderr.strip() or "f did not return a volume")[-300:])
    vol = np.array(list(r.stdout)).reshape(n, n, n)
    if not (vol != ".").any():
        raise LadderError("empty", "f returned nothing inside the unit cube")
    return vol


def _palette_raw(pal_src: str, timeout: float) -> dict:
    try:
        r = subprocess.run(["node", "-e", _PALETTE_JS], input=json.dumps({"pal_src": pal_src, "timeout": int(timeout * 1000)}),
                           capture_output=True, text=True, timeout=timeout + 3)
        data = json.loads(r.stdout) if r.returncode == 0 else None
    except (subprocess.TimeoutExpired, ValueError):
        return {}
    out = {}
    for k, v in (data.items() if isinstance(data, dict) else ()):
        color = v.get("color") if isinstance(v, dict) else v
        if len(k) == 1 and isinstance(color, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            out[k] = (color.lower(), v)
    return out


def kiln_pal(pal_src: str, timeout: float = 3.0) -> str:
    """pal_src without the `mat`/`material` tags (live-only fields kiln's pal() rejects); unchanged if it cannot be read."""
    if "mat" not in pal_src:
        return pal_src
    try:
        r = subprocess.run(["node", "-e", _CLEAN_JS], input=json.dumps({"pal_src": pal_src, "timeout": int(timeout * 1000)}),
                           capture_output=True, text=True, timeout=timeout + 3)
    except subprocess.TimeoutExpired:
        return pal_src
    return f"pal({r.stdout})" if r.returncode == 0 and r.stdout.startswith("{") else pal_src


def eval_palette(pal_src: str, timeout: float = 3.0) -> dict[str, str]:
    """{key: '#rrggbb'} from pal({...}) (string or {color: ...} values); {} if it cannot be read."""
    return {k: c for k, (c, _) in _palette_raw(pal_src, timeout).items()}


def eval_materials(pal_src: str, timeout: float = 3.0) -> dict[str, str]:
    """{key: material tag} for the same keys eval_palette returns (see materials.py)."""
    return {k: infer_tag(c, v) for k, (c, v) in _palette_raw(pal_src, timeout).items()}


def solidify(master: np.ndarray) -> np.ndarray:
    """Fill sealed interior voids (empty voxels not connected to the outside) with the surrounding material, so
    every shape is built solid. Open shapes (a cup, an arch) are left as they are. Voxels the shape marked AIR are
    deliberate hollows: they are never filled and come back as empty ('.'), so walls, ribs and heads around them show.
    Returns a new array."""
    empty = master == "."
    border = np.ones(master.shape, dtype=bool)
    border[1:-1, 1:-1, 1:-1] = False
    outside = empty & border
    while True:
        grown = outside.copy()
        for axis in range(3):
            for shift in (1, -1):
                grown |= np.roll(outside, shift, axis) & empty
        if (grown == outside).all():
            break
        outside = grown
    void = empty & ~outside
    out = master.copy()
    while void.any():
        before = int(void.sum())
        for axis in range(3):
            for shift in (1, -1):
                neighbour = np.roll(out, shift, axis)
                take = void & (neighbour != ".") & (neighbour != AIR)  # never fill a void with air
                out[take] = neighbour[take]
                void &= ~take
        if int(void.sum()) == before:
            break
    out[out == AIR] = "."
    return out


def _run_lengths(occ: np.ndarray, axis: int) -> np.ndarray:
    a = np.moveaxis(occ, axis, -1)
    n = a.shape[-1]
    idx = np.arange(n)
    start = np.maximum.accumulate(np.where(~a, idx, -1), axis=-1)
    end = np.minimum.accumulate(np.where(~a, idx, n)[..., ::-1], axis=-1)[..., ::-1]
    return np.moveaxis(np.where(a, end - start - 1, 0), -1, axis)


def master_runs(master: np.ndarray) -> np.ndarray:
    """Per voxel: the shortest same-material run through it along x, y or z (0 for empty voxels)."""
    runs = np.zeros(master.shape, dtype=np.int32)
    for k in set(np.unique(master)) - {"."}:
        occ = master == k
        m = np.minimum(np.minimum(_run_lengths(occ, 0), _run_lengths(occ, 1)), _run_lengths(occ, 2))
        runs[occ] = m[occ]
    return runs


def _thin_cells(share: np.ndarray) -> np.ndarray:
    """Cells claimed by a thin part: the cell must hold at least as much of it as each axis neighbour. A sliver of a wall
    that mostly sits in the next cell is not claimed (so a thin wall does not balloon by a cell); a pole that straddles
    two cells equally is claimed by both."""
    keep = share > 0
    padded = np.pad(share, 1)
    for axis in range(3):
        for shift in (-1, 1):
            sl = [slice(1, -1)] * 3
            sl[axis] = slice(1 + shift, share.shape[axis] + 1 + shift)
            keep &= share >= padded[tuple(sl)] - 1e-9
    return keep


def level_cells(master: np.ndarray, n: int, runs: np.ndarray | None = None) -> np.ndarray:
    """n^3 cells (y, z, x) of key characters pooled from the master volume (pass runs=master_runs(master) to reuse)."""
    N = master.shape[0]
    b = N // n
    occ = master != "."
    thin = occ & ((master_runs(master) if runs is None else runs) < THIN_CELLS * b)
    keys = sorted(set(np.unique(master)) - {"."})
    blocks = lambda a: a.reshape(n, b, n, b, n, b)  # noqa: E731
    fraction = blocks(occ).mean(axis=(1, 3, 5))
    thin_share = blocks(thin).mean(axis=(1, 3, 5))
    solid = (fraction >= FILL_FRACTION) | _thin_cells(thin_share)
    total = np.stack([blocks(master == k).sum(axis=(1, 3, 5)) for k in keys])
    thin_n = np.stack([blocks((master == k) & thin).sum(axis=(1, 3, 5)) for k in keys])
    cell_voxels = b ** 3
    feature = (thin_n >= FEATURE_SHARE * cell_voxels) & (total < 0.5 * cell_voxels)
    score = np.where(feature, thin_n, -1)
    pick = np.where(score.max(axis=0) >= 0, score.argmax(axis=0), total.argmax(axis=0))
    winner = np.array(keys)[pick]
    return np.where(solid, winner, ".")


def level_script(name: str, pal_src: str, cells: np.ndarray, n: int, size_m: tuple[float, float, float]) -> str:
    """Kiln script for one pooled level: an n^3 unit-cube grid scaled to the box (base on y=0, centred in x and z)."""
    w, h, d = size_m
    flat = "".join(cells.reshape(-1))
    return (f"{pal_src}\nconst K = {flat!r}\n"
            f"model({name!r}, {{ pivot: 'origin', scale: [{w}, {h}, {d}] }}, voxfn([{n}, {n}, {n}], (x, y, z) => {{\n"
            f"  const c = K[(y * {n} + z) * {n} + x]\n  return c === '.' ? null : c\n}}, {{ size: {1.0 / n} }}))\n")
