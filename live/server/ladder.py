"""Resolution ladder: one model-written shape function f(u,v,w) becomes a block, then 4, 8, 16, 32 cell voxel levels.

f is sampled ONCE on a 64^3 master volume (in a node vm sandbox); every level is pooled from that master with one
rule, so a level never contains something a finer level lacks. Parts thinner than ~1.5 cells (measured
per material) are kept, and a thin minority material covering 2% of a cell wins its key, so poles, hoops and
windows survive the coarse levels.
"""
import json
import subprocess

import numpy as np

LEVELS = (0, 4, 8, 16, 32)
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


def level_cells(master: np.ndarray, n: int, runs: np.ndarray | None = None) -> np.ndarray:
    """n^3 cells (y, z, x) of key characters pooled from the master volume (pass runs=master_runs(master) to reuse)."""
    N = master.shape[0]
    b = N // n
    occ = master != "."
    thin = occ & ((master_runs(master) if runs is None else runs) < THIN_CELLS * b)
    keys = sorted(set(np.unique(master)) - {"."})
    blocks = lambda a: a.reshape(n, b, n, b, n, b)  # noqa: E731
    fraction = blocks(occ).mean(axis=(1, 3, 5))
    solid = (fraction >= FILL_FRACTION) | blocks(thin).any(axis=(1, 3, 5))
    total = np.stack([blocks(master == k).sum(axis=(1, 3, 5)) for k in keys])
    thin_n = np.stack([blocks((master == k) & thin).sum(axis=(1, 3, 5)) for k in keys])
    cell_voxels = b ** 3
    feature = (thin_n >= FEATURE_SHARE * cell_voxels) & (total < 0.5 * cell_voxels)
    score = np.where(feature, thin_n, -1)
    pick = np.where(score.max(axis=0) >= 0, score.argmax(axis=0), total.argmax(axis=0))
    winner = np.array(keys)[pick]
    return np.where(solid, winner, ".")


def _majority_key(master: np.ndarray) -> str:
    keys, counts = np.unique(master[master != "."], return_counts=True)
    return str(keys[counts.argmax()])


def block_script(name: str, pal_src: str, master: np.ndarray, size_m: tuple[float, float, float]) -> str:
    """Level 0: one solid block filling the box, in the prop's most common material."""
    w, h, d = size_m
    return f"{pal_src}\nmodel({name!r}, box({w}, {h}, {d}, {{ mat: {_majority_key(master)!r} }}))\n"


def level_script(name: str, pal_src: str, cells: np.ndarray, n: int, size_m: tuple[float, float, float]) -> str:
    """Kiln script for one pooled level: an n^3 unit-cube grid scaled to the box (base on y=0, centred in x and z)."""
    w, h, d = size_m
    flat = "".join(cells.reshape(-1))
    return (f"{pal_src}\nconst K = {flat!r}\n"
            f"model({name!r}, {{ pivot: 'origin', scale: [{w}, {h}, {d}] }}, voxfn([{n}, {n}, {n}], (x, y, z) => {{\n"
            f"  const c = K[(y * {n} + z) * {n} + x]\n  return c === '.' ? null : c\n}}, {{ size: {1.0 / n} }}))\n")
