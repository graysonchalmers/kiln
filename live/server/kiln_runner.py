"""Build one kiln script into a GLB with `kiln build --no-preview`."""
import pathlib
import re
import subprocess
import time
from dataclasses import dataclass

KILN = pathlib.Path(__file__).resolve().parents[2] / "bin" / "kiln.js"


@dataclass
class BuildResult:
    ok: bool
    glb: bytes | None
    tris: int | None
    error: str | None
    seconds: float


def build_glb(script: str, workdir: pathlib.Path, timeout: float = 10.0, retry_factor: float = 4.0) -> BuildResult:
    """One kiln build. A timeout is retried once with `retry_factor` times the time: on a loaded box (load average 40+) a build
    that normally takes half a second can miss 10 s, and a dropped level is worse than a slow one."""
    r = _build_once(script, workdir, timeout)
    if not r.ok and r.error and r.error.startswith("kiln timed out") and retry_factor > 1:
        r = _build_once(script, workdir, timeout * retry_factor)
    return r


def _build_once(script: str, workdir: pathlib.Path, timeout: float) -> BuildResult:
    t0 = time.time()
    workdir = pathlib.Path(workdir)
    src, out = workdir / "script.kx.js", workdir / "out"
    src.write_text(script)
    try:
        p = subprocess.run(["node", str(KILN), "build", "--no-preview", str(src), "--out", str(out)],
                           capture_output=True, text=True, timeout=timeout, cwd=workdir)
    except subprocess.TimeoutExpired:
        return BuildResult(False, None, None, f"kiln timed out after {timeout:.0f}s", time.time() - t0)
    text = (p.stdout + p.stderr).strip()
    glbs = sorted((out / "models").glob("*.glb")) if p.returncode == 0 else []
    if not glbs:
        return BuildResult(False, None, None, text[-800:] or f"kiln exit {p.returncode}", time.time() - t0)
    tris = sum(int(n) for n in re.findall(r"(\d+) tris", text))
    return BuildResult(True, glbs[0].read_bytes(), tris, None, time.time() - t0)
