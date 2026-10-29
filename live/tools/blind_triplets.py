#!/usr/bin/env python3
"""Blind triplet sheets for paired_retry.py: per case the first attempt, the --validate retry and the --validate --ascii retry, shuffled
and labelled 01A 01B 01C. Writes sheet*.png and mapping_DO_NOT_READ_BEFORE_PICKS.json. Write picks ({"01": "ABC"} = best to worst, "=" for a
tie between neighbours like "A=BC") to picks.json BEFORE reading the mapping.
usage: blind_triplets.py PAIRED_DIR [seed]"""
import json, pathlib, random, subprocess, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
src = open(pathlib.Path(__file__).resolve().parent / "blind_pairs.py").read().split("\ndef main(")[0]
ns = {}; exec(src, ns)
render, blank = ns["render"], ns["blank"]
d = pathlib.Path(sys.argv[1]); rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 20261030)
cases = json.loads((d / "cases.json").read_text()); mapping, tiles = {}, []
for i, case in enumerate(cases, 1):
    pid = f"{i:02d}"; order = ["first", "typed", "ascii"]; rng.shuffle(order)
    mapping[pid] = {"case": case, **dict(zip("ABC", order))}
    for letter, arm in zip("ABC", order):
        png = d / f"{pid}{letter}.png"
        if not render(d / f"{case}__{arm}.json", png):
            blank(png)
        tiles.append((pid + letter, png))
for s in range(0, len(tiles), 24):
    cmd = ["montage"]
    for label, png in tiles[s:s + 24]:
        cmd += ["-label", label, str(png)]
    subprocess.run(cmd + ["-tile", "6x", "-geometry", "260x260+3+3", "-background", "#222222", "-fill", "white", "-pointsize", "18", str(d / f"sheet{s // 24 + 1}.png")], check=True)
(d / "mapping_DO_NOT_READ_BEFORE_PICKS.json").write_text(json.dumps(mapping))
print(len(cases), "cases; mapping not printed")
