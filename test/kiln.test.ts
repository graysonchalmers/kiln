import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { type Face, triangulate } from "../src/core/mesh.ts";
import { renderView } from "../src/core/render.ts";
import { cross, dot } from "../src/core/util.ts";
import { loadSource } from "../src/node/load.ts";
import { writeOutputs } from "../src/node/output.ts";

const throwsMsg = (fn: () => unknown, re: RegExp) => assert.throws(fn, (e: Error) => re.test(e.message));
const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

/** Signed volume (divergence theorem): positive and exact only if every face points outward. */
function volume(faces: Face[]): number {
  return triangulate(faces).reduce((s, t) => s + dot(t.v[0], cross(t.v[1], t.v[2])) / 6, 0);
}
const one = (src: string) => loadSource(`pal({ a: "#ff0000", b: "#00ff00" })\n${src}`).build("m");

test("primitives are closed and outward: signed volume matches the solid", () => {
  near(volume(one(`model("m", box(2, 3, 4, "a"))`).faces), 24, 1e-9);
  // n-gon prism: area = n/2 r^2 sin(2pi/n)
  near(volume(one(`model("m", cyl(1, 2, { mat: "a", sides: 8 }))`).faces), 4 * Math.sin((2 * Math.PI) / 8) * 2, 1e-9);
  near(volume(one(`model("m", cone(1, 3, { mat: "a", sides: 6 }))`).faces), ((6 / 2) * Math.sin((2 * Math.PI) / 6) * 3) / 3, 1e-9);
  // concave L outline: area 3
  near(volume(one(`model("m", extrude([0,0, 2,0, 2,1, 1,1, 1,2, 0,2], 0.5, "a"))`).faces), 1.5, 1e-9);
  near(volume(one(`model("m", prism(2, 1, 3, "a"))`).faces), 3, 1e-9);
  near(volume(one(`model("m", wedge(2, 1, 3, "a"))`).faces), 3, 1e-9);
  assert.ok(volume(one(`model("m", sphere(1, { mat: "a", detail: 2 }))`).faces) > 3.9);
  assert.ok(volume(one(`model("m", rock(1, { mat: "a" }))`).faces) > 0);
  assert.ok(volume(one(`model("m", lathe([0.5,0, 1,0.5, 0.4,1.5, 0,1.8], { mat: "a", sides: 10 }))`).faces) > 0);
});

test("mirroring and jitter keep faces outward", () => {
  near(volume(one(`model("m", sym("x", box(1, 1, 1, { mat: "a", pos: [2, 0, 0] })))`).faces), 2, 1e-9);
  near(volume(one(`model("m", tf({ scale: [-1, 1, 1] }, box(1, 2, 1, "a")))`).faces), 2, 1e-9);
  assert.ok(volume(one(`model("m", box(1, 1, 1, { mat: "a", jitter: 0.05 }))`).faces) > 0.8);
});

test("voxels: greedy meshing merges faces; volume counts voxels", () => {
  const bar = one(`model("m", voxels(["aaa"]))`);
  assert.equal(bar.faces.length, 6);
  near(volume(bar.faces), 3, 1e-9);
  const two = one(`model("m", voxels(["ab"]))`);
  assert.equal(two.faces.length, 10, "different materials don't merge");
  const cube = one(`model("m", voxfn([4, 4, 4], () => "a", { size: 0.5 }))`);
  assert.equal(cube.faces.length, 6);
  near(volume(cube.faces), 8, 1e-9);
  throwsMsg(() => one(`model("m", voxels(["az"]))`), /'z' is not a palette key/);
});

test("pivot: bottom-centered by default", () => {
  const b = one(`model("m", box(2, 1, 2, { mat: "a", pos: [5, 3, -1] }))`);
  assert.deepEqual(b.bounds.min, [-1, 0, -1]);
  assert.deepEqual(b.bounds.max, [1, 1, 1]);
});

test("variants, stamps and scatter", () => {
  const p = loadSource(`pal({ a: "#ff0000", b: "#00ff00" })
model("base", box(1, 1, 1, "a"))
model("green", { base: "base", swap: { a: "b" } })
model("two", stamp("base"), stamp("base", { pos: [3, 0, 0], swap: { a: "b" } }))
model("many", scatter("base", { area: [-5, -5, 5, 5], count: 10, seed: 2 }))`);
  assert.ok(p.build("green").faces.every((f) => f.mat === "b"));
  assert.equal(p.build("two").faces.filter((f) => f.mat === "b").length, 6);
  assert.equal(p.build("many").faces.length, 60);
  assert.deepEqual(p.build("many").faces, p.build("many").faces);
});

test("errors name the location and suggest fixes", () => {
  throwsMsg(() => loadSource(`pal({ wood: "#a8743f" })\nmodel("m",\n  box(1, 1, 1, "wod"))`), /^model\.kx\.js:3:3: box: unknown material 'wod' \(did you mean 'wood'\?\)/);
  throwsMsg(() => loadSource(`model("m", cyl(1, 1, { mat: "1", side: 6 }))`), /^model\.kx\.js:1:12: cyl: options: unknown option 'side' \(did you mean 'sides'\?\)/);
  throwsMsg(() => loadSource(`model("m", stamp("n"))\nmodel("n", stamp("m"))`).build("m"), /reference cycle through 'm'/);
  throwsMsg(() => loadSource(`model("m", stamp("bx"))\nmodel("box", box(1,1,1,"1"))`).build("m"), /unknown model 'bx' \(did you mean 'box'\?\)/);
});

test("GLB: header, chunks, one primitive per material, flat normals", () => {
  const dir = mkdtempSync(join(tmpdir(), "kiln-"));
  try {
    const p = loadSource(`pal({ a: "#ff0000", b: { color: "#00ff00", emit: "#ffffff", glow: 4 } })
model("m", box(1, 1, 1, "a"), box(0.5, 0.5, 0.5, { mat: "b", pos: [0, 1, 0] }))
pack("all", ["m"])`);
    const r = writeOutputs(p, dir, { preview: false });
    assert.equal(r.errors.length, 0);
    const buf = readFileSync(join(dir, "models/m.glb"));
    assert.equal(buf.readUInt32LE(0), 0x46546c67);
    assert.equal(buf.readUInt32LE(8), buf.length);
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen));
    assert.equal(json.asset.version, "2.0");
    assert.equal(json.meshes[0].primitives.length, 2);
    assert.deepEqual(json.extensionsUsed, ["KHR_materials_emissive_strength"]);
    const counts = json.meshes[0].primitives.map((pr: { attributes: { POSITION: number } }) => json.accessors[pr.attributes.POSITION].count);
    assert.deepEqual(counts, [36, 36]);
    const binLen = buf.readUInt32LE(20 + jsonLen);
    assert.equal(binLen, json.buffers[0].byteLength);
    assert.ok(readFileSync(join(dir, "all.glb")).length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lights travel with stamps and export as KHR_lights_punctual", () => {
  const p = loadSource(`model("lamp", { pivot: "origin" }, box(0.2, 0.2, 0.2, "1"), light({ type: "spot", power: 50, pos: [0, -0.1, 0], dir: [0, -1, 0], angle: 40 }))
model("room", { pivot: "origin" }, stamp("lamp", { pos: [1, 2, 3] }), sym("x", stamp("lamp", { pos: [2, 2, 0] })))`);
  const b = p.build("room");
  assert.equal(b.lights.length, 3);
  assert.deepEqual(b.lights[0].pos.map((v) => Math.round(v * 100) / 100), [1, 1.9, 3]);
  assert.deepEqual(b.lights.slice(1).map((l) => l.pos[0]).sort(), [-2, 2]);
  const dir = mkdtempSync(join(tmpdir(), "kiln-"));
  try {
    writeOutputs(p, dir, { preview: false, only: ["room"] });
    const buf = readFileSync(join(dir, "models/room.glb"));
    const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
    assert.ok(json.extensionsUsed.includes("KHR_lights_punctual"));
    const lights = json.extensions.KHR_lights_punctual.lights;
    assert.equal(lights.length, 3);
    near(lights[0].intensity, (50 * 683) / (4 * Math.PI), 1e-6);
    assert.equal(lights[0].type, "spot");
    // light nodes are children of the mesh node; -Z rotated to point down
    const ln = json.nodes.find((n: { extensions?: unknown }) => n.extensions);
    const [x, y, z, w] = ln.rotation;
    near(-2 * (y * z - w * x), -1, 1e-6);   // y of R·(0, 0, -1) = -R[1][2]: the spot points straight down
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the preview renderer draws the model in its material color", () => {
  const b = one(`model("m", box(1, 1, 1, "a"))`);
  const img = renderView(b.faces, b.pal, b.bounds, { w: 64, h: 64, ground: false, yaw: 0, pitch: 0 });
  const i = (32 * 64 + 32) * 4;
  assert.ok(img[i] > 120 && img[i + 1] < 40 && img[i + 2] < 40, `center pixel ${img.slice(i, i + 3)} should be red`);
});
