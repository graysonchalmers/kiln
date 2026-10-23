import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { crc32, deflateSync } from "node:zlib";
import { type Face, faceNormal, triangulate } from "../src/core/mesh.ts";
import { png } from "../src/core/png.ts";
import { cross, dot } from "../src/core/util.ts";
import { loadProject, loadSource } from "../src/node/load.ts";
import { writeOutputs } from "../src/node/output.ts";
import { decodeRgba } from "../src/node/textures.ts";

const throwsMsg = (fn: () => unknown, re: RegExp) => assert.throws(fn, (e: Error) => re.test(e.message));
const near = (a: number, b: number, tol: number, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} not within ${tol} of ${b}`);
const volume = (faces: Face[]) => triangulate(faces).reduce((s, t) => s + dot(t.v[0], cross(t.v[1], t.v[2])) / 6, 0);
const one = (src: string) => loadSource(`pal({ a: "#ff0000", b: "#00ff00", c: "#0000ff" })\n${src}`).build("m");

/** A raw PNG of one color type and bit depth (filter 0 rows), for the decoder. */
function rawPng(w: number, h: number, type: number, depth: number, samples: number[]): Buffer {
  const chans = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[type], bytes = depth / 8, row = w * chans * bytes;
  const raw = Buffer.alloc(h * (row + 1));
  for (let y = 0; y < h; y++) for (let i = 0; i < w * chans; i++) {
    const v = samples[y * w * chans + i], o = y * (row + 1) + 1 + i * bytes;
    if (depth === 16) { raw[o] = v >> 8; raw[o + 1] = v & 255; } else raw[o] = v;
  }
  const chunk = (t: string, d: Buffer) => { const head = Buffer.alloc(8); head.writeUInt32BE(d.length, 0); head.write(t, 4, "ascii"); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), d])) >>> 0, 0); return Buffer.concat([head, d, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = depth; ihdr[9] = type;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

test("torus and tube are closed and outward; the tube follows its path without twisting", () => {
  const t = one(`model("m", { pivot: "origin" }, torus(2, 0.5, { mat: "a", rings: 48, sides: 24 }))`);
  near(volume(t.faces), 2 * Math.PI ** 2 * 2 * 0.25, 0.4);
  assert.equal(t.faces.length, 48 * 24);
  const straight = one(`model("m", { pivot: "origin" }, tube([0, 0, 0, 0, 3, 0], 0.5, { mat: "a", sides: 8 }))`);
  near(volume(straight.faces), 8 / 2 * 0.25 * Math.sin((2 * Math.PI) / 8) * 3, 1e-9);
  assert.equal(straight.faces.length, 8 + 2, "8 sides and two caps");
  const bent = one(`model("m", { pivot: "origin" }, tube([0, 0, 0, 2, 0, 0, 2, 2, 0, 2, 2, 2], 0.3, { mat: "b", sides: 6 }))`);
  near(volume(bent.faces), 6 / 2 * 0.09 * Math.sin(Math.PI / 3) * 6, 0.05, "mitered bends keep the cross section");
  // every ring vertex stays r away from its path point: the frame never collapses
  for (const f of bent.faces) for (const p of f.v) assert.ok(Math.hypot(p[0], p[1], p[2]) > 0.2);
  const ring = one(`model("m", { pivot: "origin" }, tube([1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, -1], 0.2, { mat: "a", sides: 6, closed: true }))`);
  assert.equal(ring.faces.length, 4 * 6, "closed: no caps, one segment back to the start");
  assert.ok(volume(ring.faces) > 0);
  throwsMsg(() => one(`model("m", tube([0, 0, 0], 1, "a"))`), /at least 2 points/);
  // top: linear taper by arc length, a frustum along a straight path
  const taper = one(`model("m", { pivot: "origin" }, tube([0, 0, 0, 0, 1, 0, 0, 3, 0], 0.6, { mat: "a", sides: 8, top: 0.2 }))`);
  const ry = (y: number) => Math.max(...taper.faces.flatMap((f) => f.v).filter((p) => Math.abs(p[1] - y) < 1e-9).map((p) => Math.hypot(p[0], p[2])));
  near(ry(0), 0.6, 1e-9); near(ry(1), 0.6 - 0.4 / 3, 1e-9, "radius follows arc length"); near(ry(3), 0.2, 1e-9);
  // r as a list: one radius per point (a flared base in the same mesh)
  const flare = one(`model("m", { pivot: "origin" }, tube([0, 0, 0, 0, 0.2, 0, 0, 2, 0], [0.9, 0.4, 0.3], { mat: "a", sides: 8 }))`);
  const fy = (y: number) => Math.max(...flare.faces.flatMap((f) => f.v).filter((p) => Math.abs(p[1] - y) < 1e-9).map((p) => Math.hypot(p[0], p[2])));
  near(fy(0), 0.9, 1e-9); near(fy(0.2), 0.4, 1e-9); near(fy(2), 0.3, 1e-9);
  throwsMsg(() => one(`model("m", tube([0, 0, 0, 0, 1, 0], [1, 2, 3], { mat: "a" }))`), /one radius per point/);
});

test("rock flat: the underside is cut to a plane, so it sits on a face", () => {
  const ys = (src: string) => one(`model("m", { pivot: "origin" }, ${src})`).faces.flatMap((f) => f.v.map((p) => p[1]));
  const round = ys(`rock(1, { mat: "a", squash: 0.8, seed: 3 })`), cut = ys(`rock(1, { mat: "a", squash: 0.8, seed: 3, flat: 0.4 })`);
  near(Math.min(...cut), -0.8 * 0.6, 1e-9, "floor at (1 - flat) of the half height");
  assert.ok(cut.filter((y) => Math.abs(y + 0.48) < 1e-9).length >= 6, "a contact face, not a point");
  assert.ok(Math.min(...round) < -0.48, "flat 0 leaves the rock as it was");
  const rock = one(`model("m", { pivot: "origin" }, rock(1, { mat: "a", flat: 0.4 }))`);
  assert.ok(volume(rock.faces) > 0, "still closed and outward");
});

test("cap: up-facing faces take the cap material (moss on a rock's own faces, no second shell)", () => {
  const r = one(`model("m", { pivot: "origin" }, rock(1, { mat: "a", cap: "b", capAngle: 40, seed: 2 }))`);
  const capped = r.faces.filter((f) => f.mat === "b"), plain = r.faces.filter((f) => f.mat === "a");
  assert.ok(capped.length > 0 && plain.length > 0, "both materials present");
  for (const f of capped) assert.ok(faceNormal(f.v)[1] > Math.cos((40 + 14) * Math.PI / 180) - 1e-9, "only up-facing faces are capped");
  assert.ok(capped.length + plain.length === one(`model("m", { pivot: "origin" }, rock(1, { mat: "a", seed: 2 }))`).faces.length, "same faces, recolored");
  throwsMsg(() => one(`model("m", rock(1, { mat: "a", cap: "nope" }))`), /cap: a palette key/);
});

test("hull: separate masses become one closed convex shape", () => {
  const two = one(`model("m", { pivot: "origin" }, sphere(1, { mat: "a" }), sphere(1, { mat: "a", pos: [3, 0, 0] }))`);
  const h = one(`model("m", { pivot: "origin" }, hull({ mat: "b" }, sphere(1, { mat: "a" }), sphere(1, { mat: "a", pos: [3, 0, 0] })))`);
  assert.ok(volume(h.faces) > volume(two.faces) * 1.6, "the hull bridges the gap between the two spheres");
  assert.ok(h.faces.every((f) => f.mat === "b"), "one material");
  // every hull vertex is on or inside every face plane: convex and outward
  const vs = h.faces.flatMap((f) => f.v);
  for (const f of h.faces) { const n = faceNormal(f.v), d = dot(n, f.v[0]); for (const p of vs) assert.ok(dot(n, p) - d < 1e-6); }
  near(h.bounds.max[0] - h.bounds.min[0], two.bounds.max[0] - two.bounds.min[0], 1e-9, "same extent as its inputs");
  assert.throws(() => one(`model("m", hull({ mat: "a" }, box(1, 1, 0, "a")))`));
});

test("subtract: a cutter carves the base; the carved walls take the cutter's material", () => {
  // a 2 m cube (x, z -1..1, y 0..2) minus a 1 m cube overlapping one top corner by 0.5 m on each axis
  const cut = one(`model("m", { pivot: "origin" }, subtract(box(2, 2, 2, "a"), box(1, 1, 1, { mat: "b", pos: [1, 1.5, 1] })))`);
  near(volume(cut.faces), 8 - 0.125, 1e-6, "volume");
  const walls = cut.faces.filter((f) => f.mat === "b");
  assert.ok(walls.length >= 3, "three carved walls in the cutter's material");
  for (const f of walls) for (const p of f.v) assert.ok(p[0] <= 1 + 1e-9 && p[1] <= 2 + 1e-9 && p[2] <= 1 + 1e-9, "walls stay inside the base");
  const miss = one(`model("m", { pivot: "origin" }, subtract(box(1, 1, 1, "a"), box(1, 1, 1, { mat: "b", pos: [5, 0, 0] })))`);
  near(volume(miss.faces), 1, 1e-9, "a cutter that misses changes nothing");
  throwsMsg(() => one(`model("m", subtract(box(1, 1, 1, "a")))`), /at least one cutter/);
});

test("terrain: a heightfield from a function with per-triangle materials by height and slope", () => {
  const flat = one(`model("m", terrain(4, 2, { mat: "a", res: [4, 2], fn: () => 0.5, height: 2 }))`);
  assert.equal(flat.faces.length, 16);
  assert.deepEqual(flat.bounds.min.map((v) => Math.round(v * 100) / 100), [-2, 0, -1]);
  assert.deepEqual(flat.bounds.max.map((v) => Math.round(v * 100) / 100), [2, 0, 1]);
  const hill = one(`model("m", terrain(10, 10, { res: 10, height: 3, fn: (x, z) => 1 - Math.min(1, Math.hypot(x, z) / 5),
    mat: (h, slope) => (h > 0.5 ? "b" : slope > 0.1 ? "c" : "a") }))`);
  near(hill.bounds.max[1] - hill.bounds.min[1], 3, 0.3);
  const mats = new Set(hill.faces.map((f) => f.mat));
  assert.ok(mats.has("a") && mats.has("b") && mats.has("c"), `height and slope pick materials: ${[...mats]}`);
  for (const f of hill.faces) assert.ok(faceNormal(f.v)[1] > 0, "every triangle faces up");
  throwsMsg(() => one(`model("m", terrain(4, 4, { mat: "a" }))`), /needs fn/);
  throwsMsg(() => one(`model("m", terrain(4, 4, { mat: () => 3, fn: () => 0 }))`), /return a palette key/);
  throwsMsg(() => one(`model("m", box(1, 1, 1, { mat: () => "a" }))`), /mat must be a palette key/);
});

test("decodeRgba reads gray, 16-bit gray and palette PNGs; terrain reads a 16-bit height map", () => {
  const g16 = decodeRgba(rawPng(2, 2, 0, 16, [0, 65535, 32768, 1000]));
  assert.deepEqual([...g16.hi!], [0, 65535, 32768, 1000]);
  assert.deepEqual([...g16.rgba.subarray(4, 8)], [255, 255, 255, 255]);
  const ga = decodeRgba(rawPng(1, 1, 4, 8, [200, 7]));
  assert.deepEqual([...ga.rgba], [200, 200, 200, 7]);
  assert.equal(decodeRgba(png(3, 2, new Uint8Array(24).fill(9), (b) => deflateSync(b))).rgba[23], 9);
  throwsMsg(() => decodeRgba(Buffer.from("nope")), /not a PNG/);
  const dir = mkdtempSync(join(tmpdir(), "kiln-hm-"));
  // a 4x4 16-bit height map: left half low, right half high
  writeFileSync(join(dir, "h.png"), rawPng(4, 4, 0, 16, Array.from({ length: 16 }, (_, i) => (i % 4 < 2 ? 0 : 65535))));
  writeFileSync(join(dir, "m.kx.js"), `pal({ a: "#ff0000" })\nmodel("m", { pivot: "origin" }, terrain(4, 4, { mat: "a", res: 8, height: 2, heightmap: "h.png" }))`);
  const t = loadProject(join(dir, "m.kx.js")).build("m");
  near(t.bounds.max[1], 2, 1e-6);
  near(t.bounds.min[1], 0, 1e-6);
  const left = t.faces.filter((f) => f.v.every((p) => p[0] < -1)), right = t.faces.filter((f) => f.v.every((p) => p[0] > 1));
  assert.ok(left.every((f) => f.v.every((p) => p[1] < 0.01)) && right.every((f) => f.v.every((p) => p[1] > 1.99)));
});

test("voximg turns a PNG into voxels with a material per color, standing or flat", () => {
  const dir = mkdtempSync(join(tmpdir(), "kiln-vi-"));
  const rgba = new Uint8Array(3 * 2 * 4);
  rgba.set([255, 0, 0, 255], 0); rgba.set([255, 0, 0, 255], 4); rgba.set([0, 0, 255, 255], 8);   // top row: red red blue
  rgba.set([0, 0, 0, 0], 12); rgba.set([0, 255, 0, 255], 16); rgba.set([0, 0, 0, 10], 20);           // bottom: clear green faint
  writeFileSync(join(dir, "s.png"), png(3, 2, rgba, (b) => deflateSync(b)));
  writeFileSync(join(dir, "m.kx.js"), `model("up", voximg("s.png", { size: 0.5, depth: 2 }))\nmodel("flat", { pivot: "origin" }, voximg("s.png", { size: 1, flat: true }))\nmodel("named", voximg("s.png", { size: 1, alpha: 5 }))`);
  const p = loadProject(join(dir, "m.kx.js"));
  const up = p.build("up");
  near(volume(up.faces), 4 * 2 * 0.125, 1e-9);
  assert.deepEqual(up.bounds.max.map((v) => Math.round(v * 100) / 100), [0.75, 1, 0.5]);
  assert.deepEqual([...new Set(up.faces.map((f) => f.mat))].sort(), ["px_0000ff", "px_00ff00", "px_ff0000"]);
  assert.equal(up.pal.get("px_ff0000").color, "#ff0000");
  // standing: the image's top row is the top layer; green (bottom row, column 1) sits at y 0..0.5
  const green = up.faces.filter((f) => f.mat === "px_00ff00");
  assert.ok(green.every((f) => f.v.every((p) => p[1] <= 0.5 + 1e-9)));
  const flat = p.build("flat");
  assert.deepEqual(flat.bounds.max, [1.5, 1, 1]);
  assert.equal(p.build("named").faces.filter((f) => f.mat === "px_000000").length > 0, true, "alpha threshold admits the faint pixel");
  throwsMsg(() => loadSource(`model("m", voximg("nope.png"))`), /cannot read image/);
});

test("--stl writes a binary STL with one triangle per face triangle and outward normals", () => {
  const dir = mkdtempSync(join(tmpdir(), "kiln-stl-"));
  const p = loadSource(`model("cube", box(1, 2, 3, "1"))`);
  const r = writeOutputs(p, dir, { preview: false, stl: true });
  assert.equal(r.errors.length, 0);
  const b = readFileSync(join(dir, "models/cube.stl"));
  assert.equal(b.readUInt32LE(80), 12);
  assert.equal(b.length, 84 + 12 * 50);
  // first triangle's normal is a unit vector
  near(Math.hypot(b.readFloatLE(84), b.readFloatLE(88), b.readFloatLE(92)), 1, 1e-6);
  assert.match(b.toString("ascii", 0, 9), /^kiln cube/);
});
