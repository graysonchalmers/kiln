import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProject } from "../src/node/load.ts";
test("leaf angle: the drawn tip segment slopes at the requested angle", () => {
  const dir = mkdtempSync(join(tmpdir(), "kiln-leaf-"));
  for (const deg of [10, 20, 35]) {
    const f = join(dir, `l${deg}.kx.js`);
    writeFileSync(f, `include("${process.cwd()}/lib/grayson/nature.kx.js")\npal({ leaf: "#00ff00" })\nmodel("m", { pivot: "origin" }, leaf(1, { angle: ${deg}, lift: 0.1, segs: 4, thick: 0.001, w0: 0.001 }))`);
    const pts = loadProject(f).build("m").faces.flatMap((q) => q.v), zMax = Math.max(...pts.map((p) => p[2]));
    const tip = pts.filter((p) => p[2] > zMax - 0.26);
    const a = tip.reduce((m, p) => (p[2] < m[2] ? p : m)), c = tip.reduce((m, p) => (p[2] > m[2] ? p : m));
    const got = Math.atan2(a[1] - c[1], c[2] - a[2]) * 180 / Math.PI;
    assert.ok(Math.abs(got - deg) < 1.5, `asked ${deg}, got ${got}`);
  }
});
