import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { type Face, triangulate } from "../src/core/mesh.ts";
import { renderView } from "../src/core/render.ts";
import { cross, dot } from "../src/core/util.ts";
import { loadSource } from "../src/node/load.ts";
import { writeOutputs } from "../src/node/output.ts";
import { serve } from "../src/node/server.ts";
import { deflateSync } from "node:zlib";
import { glb } from "../src/core/gltf.ts";
import { png } from "../src/core/png.ts";
import { loadProject } from "../src/node/load.ts";

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

test("model lights shade a flat quad smoothly: no step along its triangle split (the lantern-post seam)", () => {
  // lit once per triangle, this quad stepped by 10 levels across its diagonal; lit per corner, by 1
  const b = loadSource(`pal({ a: "#707070" })\nmodel("m", { pivot: "origin" }, box(2, 0.02, 2, "a"), light({ type: "point", color: "#ffffff", power: 3, pos: [0.3, 0.25, 0.7] }))`).build("m");
  const w = 96, img = renderView(b.faces, b.pal, b.bounds, { w, h: w, ground: false, yaw: 0, pitch: 89.5, lights: b.lights, mood: "day" });
  let jump = 0;
  for (let y = 30; y < 66; y++) for (let x = 30; x < 66; x++) { const i = (y * w + x) * 4; jump = Math.max(jump, Math.abs(img[i + 1] - img[i + 5]), Math.abs(img[i + 1] - img[i + 1 + w * 4])); }
  assert.ok(jump <= 3, `largest step between neighbouring pixels on the lit quad: ${jump}`);
});

test("a pack previews models whose palettes were set at different points in the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "kiln-pack-"));
  try {
    const file = join(dir, "p.kx.js");
    writeFileSync(file, `pal({ red: "#ff0000" })\nmodel("one", box(1, 1, 1, "red"))\npal({ grn: "#00ff00" })\nmodel("two", box(1, 1, 1, "grn"))\npack("both", ["one", "two"])`);
    writeOutputs(loadProject(file), join(dir, "out"), {});
    assert.ok(readFileSync(join(dir, "out", "_preview", "both.png")).length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the preview renderer draws the model in its material color", () => {
  const b = one(`model("m", box(1, 1, 1, "a"))`);
  const img = renderView(b.faces, b.pal, b.bounds, { w: 64, h: 64, ground: false, yaw: 0, pitch: 0 });
  const i = (32 * 64 + 32) * 4;
  assert.ok(img[i] > 120 && img[i + 1] < 40 && img[i + 2] < 40, `center pixel ${img.slice(i, i + 3)} should be red`);
  // a model with a light previews at night unless settings({ mood: "day" }) keeps it under the kit's daylight
  const src = `model("m", box(1, 1, 1, "a"), light({ type: "point", color: "#ffffff", power: 1, pos: [3, 3, 3] }))`;
  const px = (pre: string) => { const m = one(pre + src); assert.equal(m.mood, pre ? "day" : undefined);
    return renderView(m.faces, m.pal, m.bounds, { w: 64, h: 64, ground: false, yaw: 0, pitch: 0, lights: m.lights, mood: m.mood })[i]; };
  assert.ok(px(`settings({ mood: "day" })\n`) > px("") * 2, "day mood is lit by daylight, not just the model's light");
  throwsMsg(() => one(`settings({ mood: "dusk" })`), /mood: "day" \| "night"/);
});

test("parts and clips: posing rotates about the pivot; GLB gets part nodes and animations", async () => {
  const { poseFaces } = await import("../src/core/anim.ts");
  const p = loadSource(`model("m", { pivot: "origin" }, box(1, 1, 1, "1"),
  part("arm", { pivot: [0, 1, 0] }, box(0.2, 1, 0.2, { mat: "2", pos: [0, 1, 0] }),
    part("hand", { pivot: [0, 2, 0] }, box(0.1, 0.1, 0.1, { mat: "3", pos: [0, 2, 0] }))))
animate("m", "raise", { frames: 10, fps: 10 }, { arm: { rot: [[0, [0, 0, 0], "linear"], [10, [0, 0, 90]]] } })`);
  const b = p.build("m");
  assert.deepEqual(b.joints.map((j) => [j.name, j.parent ?? null]), [["arm", null], ["hand", "arm"]]);
  // at frame 10 the arm points along -x (90° about z), and the hand follows it
  const posed = poseFaces(b.faces, b.lights, b.joints, p.clips[0].tracks, 10);
  const hand = posed.faces.filter((f) => f.part === "hand").flatMap((f) => f.v);
  near(Math.max(...hand.map((v) => v[0])), -1, 1e-6);
  near(Math.min(...hand.map((v) => v[0])), -1.1, 1e-6);
  const dir = mkdtempSync(join(tmpdir(), "kiln-"));
  try {
    writeOutputs(p, dir, { preview: false });
    const buf = readFileSync(join(dir, "models/m.glb"));
    const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
    const byName = Object.fromEntries(json.nodes.map((n: { name: string }, i: number) => [n.name, [n, i]]));
    assert.deepEqual(byName["m.arm"][0].translation, [0, 1, 0]);
    assert.deepEqual(byName["m.arm.hand"]?.[0]?.translation ?? byName["m.hand"][0].translation, [0, 1, 0]);
    assert.ok(byName.m[0].children.includes(byName["m.arm"][1]));
    const anim = json.animations[0];
    assert.equal(anim.name, "raise");
    assert.equal(anim.channels[0].target.path, "rotation");
    assert.equal(json.accessors[anim.samplers[0].input].count, 11);
    assert.equal(json.accessors[anim.samplers[0].input].max[0], 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  throwsMsg(() => loadSource(`model("m", part("a", { pivot: [0, 0, 0] }, box(1, 1, 1, "1")), part("a", { pivot: [0, 0, 0] }, box(1, 1, 1, "1")))`).build("m"),
    /part 'a' appears twice: stamp copies with \{ as: "name" \}/);
  throwsMsg(() => loadSource(`animate("m", "c", { frames: 4 }, { a: { spin: [[0, 1]] } })`), /unknown channel 'spin'/);
});

test("serve: feedback pins are picked onto the model: point, material, build step", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kiln-fb-"));
  const file = join(dir, "a.kx.js");
  // a red box in front (step 0), a blue one behind it (step 1); seen head-on, the middle is the red one
  writeFileSync(file, `pal({ r: "#ff0000", b: "#0000ff" })
model("pair", { pivot: "origin" }, box(1, 1, 1, { mat: "r", pos: [0, 0, 1] }), box(3, 3, 0.2, { mat: "b", pos: [0, -1, -1] }))`);
  const s = await serve(file, { port: 0, out: join(dir, "out"), log: () => {} });
  const post = (body: unknown) => fetch(s.url + "api/feedback", { method: "POST", body: JSON.stringify(body) });
  try {
    const view = { yaw: 0, pitch: 0, w: 200, h: 200 };
    const r = await post({ name: "pair", view, comment: "c", pins: [{ x: 100, y: 100, text: "front", color: "#ff3df0" }, { x: 2, y: 2, text: "sky" }],
      strokes: [{ color: "#2ee6ff", points: [[100, 100], [101, 100], [2, 2]] }] });
    assert.equal(r.status, 200);
    const fb = JSON.parse(readFileSync(join(dir, "out", "_feedback", "pair.json"), "utf8"));
    const hit = fb.pins[0].hit;
    assert.equal(hit.mat, "r");
    assert.equal(hit.step.index, 0);
    assert.ok(Math.abs(hit.point[2] - 1.5) < 1e-6, "the front face of the front box, at z = 1.5");
    assert.deepEqual(hit.normal, [0, 0, 1]);
    assert.equal(fb.pins[1].hit, null, "background is a miss");
    assert.deepEqual([fb.strokes[0].onModel, fb.strokes[0].covers[0].mat], [2, "r"]);
    assert.equal((await post({ name: "pair", view: { yaw: 0 } })).status, 400);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loom textures: GLB gets UVs, embedded maps and PBR texture slots; the preview samples the albedo", () => {
  const dir = mkdtempSync(join(tmpdir(), "kiln-tex-"));
  try {
    // a minimal loom output folder: 4×4 maps and a manifest
    const lm = join(dir, "red_tiles");
    mkdirSync(lm);
    const solid = (r: number, g: number, b: number) => png(4, 4, new Uint8Array(16 * 4).map((_, i) => [r, g, b, 255][i % 4]), (x) => deflateSync(x));
    writeFileSync(join(lm, "red_tiles_albedo.png"), solid(255, 0, 0));
    writeFileSync(join(lm, "red_tiles_normal.png"), solid(128, 128, 255));
    writeFileSync(join(lm, "red_tiles_orm.png"), solid(255, 200, 0));
    writeFileSync(join(lm, "red_tiles.material.json"), JSON.stringify({ name: "red_tiles", normal: "gl", maps: { albedo: "red_tiles_albedo.png", normal: "red_tiles_normal.png", orm: "red_tiles_orm.png", emissive: null } }));
    const file = join(dir, "a.kx.js");
    writeFileSync(file, `pal({ t: { tex: "red_tiles", uv: 0.5, bump: 0.8 } })\nmodel("cube", box(1, 1, 1, "t"))`);
    const p = loadProject(file), b = p.build("cube");
    const bytes = glb([{ name: "cube", faces: b.faces, pal: b.pal }]);
    const len = new DataView(bytes.buffer).getUint32(12, true), json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
    assert.ok(json.meshes[0].primitives[0].attributes.TEXCOORD_0 !== undefined, "UVs");
    assert.equal(json.images.length, 3, "albedo, normal, ORM (ORM shared by metallicRoughness and occlusion)");
    const mat = json.materials[0];
    assert.ok(mat.pbrMetallicRoughness.baseColorTexture && mat.pbrMetallicRoughness.metallicRoughnessTexture && mat.occlusionTexture, "PBR slots");
    assert.equal(mat.normalTexture.scale, 0.8);
    assert.deepEqual(json.samplers[0], { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
    // the preview: textured red, not the default white tint
    const rgba = renderView(b.faces, b.pal, b.bounds, { w: 64, h: 64, ground: false });
    const c = (32 * 64 + 32) * 4;
    assert.ok(rgba[c] > rgba[c + 1] * 2 && rgba[c] > 60, `center pixel should be red, got ${[rgba[c], rgba[c + 1], rgba[c + 2]]}`);
    writeFileSync(file, `pal({ t: { tex: "missing_folder" } })\nmodel("cube", box(1, 1, 1, "t"))`);
    throwsMsg(() => loadProject(file), /no loom material at 'missing_folder'/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
