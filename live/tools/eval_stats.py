#!/usr/bin/env python3
"""Automatic counts for the better-builds eval (criteria: docs/superpowers/specs/2026-10-28-better-builds-eval-criteria.md).
usage: eval_stats.py ARMDIR [ARMDIR ...]     (each has results.jsonl from prompt_eval.py and the saved 32-cell grids)"""
import json, pathlib, statistics, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "server"))
import config  # noqa: E402

TRIGGERS = set(config.TRIGGER_CODES)


def stats(d: pathlib.Path) -> dict:
    rows = [json.loads(l) for l in (d / "results.jsonl").read_text().splitlines()]
    ok = [r for r in rows if r["ok"]]
    final = [set((r.get("checks") or {}).get("final") or []) for r in ok]
    first = [set((r.get("checks") or {}).get("first") or []) for r in ok if (r.get("checks") or {}).get("first") is not None]
    retried = [r for r in ok if (r.get("checks") or {}).get("retried")]
    kept = []
    for r in ok:
        f = d / f"{r['name']}_{r['run']}.json"
        if not f.exists():
            continue
        g = json.loads(f.read_text())
        cells = g["cells"]
        keys = [k for k in g["palette"] if k != "_"]
        if keys:
            kept.append(sum(cells.count(k) >= 3 for k in keys) / len(keys))
    lat = sorted(r["latency_s"] for r in ok)
    codes = lambda sets: {c: sum(c in s for s in sets) for c in ("floating", "short", "ground", "thin", "key_missing")}  # noqa: E731
    return {
        "arm": d.name, "requests": len(rows),
        "M1_failed": len(rows) - len(ok), "failed": [f'{r["name"]}_{r["run"]}: {r.get("error")}' for r in rows if not r["ok"]],
        "M2_floating_runs": sum("floating" in s for s in final),
        "M3_trigger_runs": sum(bool(s & TRIGGERS) for s in final),
        "M4_key_survival": round(sum(kept) / len(kept), 3) if kept else None,
        "M5_latency_median_s": round(statistics.median(lat), 1) if lat else None,
        "M5_latency_p90_s": round(lat[int(0.9 * (len(lat) - 1))], 1) if lat else None,
        "M7_retried": len(retried),
        "M7_resolved": sum(not (set(r["checks"]["final"]) & TRIGGERS) for r in retried),
        "fire_first_attempt": codes(first), "fire_final": codes(final),
        "runs_with_problems_first": sum(bool(s & TRIGGERS) for s in first), "first_n": len(first),
    }


if __name__ == "__main__":
    for a in sys.argv[1:]:
        print(json.dumps(stats(pathlib.Path(a)), indent=1))
