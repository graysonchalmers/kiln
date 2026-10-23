// Nature set-dressing kit: organic environment props. 2026-10-22.
pal({
  leaf: "#3d8c48", leafL: "#74c45a", leafD: "#255238", autumn: "#d8742c", autumnL: "#f0a83a",
  bark: "#6e4535", barkD: "#3b2622", birch: "#e8e2d4", birchK: "#2e2a28", wood: "#9c6a4d", ring: "#d9b382",
  stone: "#7a7f96", stoneL: "#a2a7c2", stoneD: "#4e5266", moss: "#5f8f3a",
  grass: "#74c45a", grassD: "#4a9a3c", dirt: "#6f4337",
  capR: "#d8374c", capB: "#b88a5a", stem: "#f2e6cf", dots: "#fff8ec",
  petalP: "#e86aa0", petalY: "#ffd34a", petalW: "#f6f2ea", petalB: "#6a8ae8",
  berry: "#c0283c", reed: "#7a9a4a", cattail: "#5a3a24",
  water: { color: "#3e8fd8", rough: 0.08 }, lily: "#4f9a3a",
  crystal: { color: "#a678d6", rough: 0.2, emit: "#b98cff", glow: 2.5 },
  flame: { color: "#ff7a1f", emit: "#ff8020", glow: 6 }, flameL: { color: "#ffe86e", emit: "#ffe070", glow: 8 },
})

// ---------- trees
model("oak",
  cyl(0.18, 1.2, { mat: "bark", sides: 7, top: 0.12, jitter: 0.02 }),
  tube([0, 0.9, 0, 0.35, 1.3, 0.1, 0.55, 1.6, 0.15], 0.06, { mat: "bark" }),
  tube([0, 1.0, 0, -0.4, 1.45, -0.1], 0.06, { mat: "bark" }),
  sphere(0.75, { mat: "leaf", pos: [0, 1.75, 0], scale: [1.1, 0.85, 1], jitter: 0.07, seed: 1 }),
  sphere(0.55, { mat: "leafL", pos: [0.45, 2.1, 0.2], jitter: 0.06, seed: 2 }),
  sphere(0.5, { mat: "leafD", pos: [-0.5, 1.55, -0.2], jitter: 0.06, seed: 3 }),
  sphere(0.42, { mat: "leafL", pos: [-0.15, 2.3, -0.25], jitter: 0.05, seed: 4 }))
model("oak_autumn", { base: "oak", swap: { leaf: "autumn", leafL: "autumnL", leafD: "barkD" } })

model("pine",
  cyl(0.12, 0.7, { mat: "barkD", sides: 5 }),
  [[0.8, 0.5, 1.1], [0.62, 1.05, 0.95], [0.44, 1.55, 0.8], [0.26, 2.0, 0.6]].map(([r, y, h], i) =>
    cone(r, h, { mat: i % 2 ? "leaf" : "leafD", sides: 7, pos: [0, y, 0], rot: [0, i * 23, 0], jitter: 0.035, seed: 10 + i })))

model("birch",
  cyl(0.08, 2.4, { mat: "birch", sides: 6, top: 0.06 }),
  [0.4, 0.9, 1.4, 1.9].map((y, i) => cyl(0.085, 0.05, { mat: "birchK", sides: 6, pos: [0, y, 0], rot: [0, i * 40, 8] })),
  sphere(0.45, { mat: "leafL", pos: [0, 2.5, 0], scale: [0.8, 1.3, 0.8], jitter: 0.06, seed: 21 }),
  sphere(0.3, { mat: "leaf", pos: [0.2, 2.1, 0.1], jitter: 0.05, seed: 22 }))

model("dead_tree",
  cyl(0.15, 1.6, { mat: "barkD", sides: 6, top: 0.08, jitter: 0.03 }),
  tube([0, 1.0, 0, 0.3, 1.4, 0, 0.6, 1.5, 0.1], 0.05, { mat: "barkD" }),
  tube([0, 1.3, 0, -0.25, 1.8, 0.1, -0.35, 2.1, 0.0], 0.04, { mat: "barkD" }),
  tube([0, 1.55, 0, 0.1, 2.0, -0.2], 0.035, { mat: "barkD" }))

// ---------- shrubs, ground cover
model("bush",
  sphere(0.4, { mat: "leaf", scale: [1, 0.7, 1], jitter: 0.04, seed: 5, pos: [0, 0.25, 0] }),
  sphere(0.3, { mat: "leafL", pos: [0.35, 0.28, 0.1], scale: [1, 0.75, 1], jitter: 0.04, seed: 6 }),
  sphere(0.28, { mat: "leafD", pos: [-0.33, 0.2, -0.08], scale: [1, 0.7, 1], jitter: 0.04, seed: 7 }))
model("berry_bush", stamp("bush"),
  [[0.2, 0.45, 0.3], [-0.15, 0.4, 0.32], [0.45, 0.35, 0.25], [-0.4, 0.3, 0.2], [0.05, 0.55, 0.15]].map(p =>
    sphere(0.04, { mat: "berry", pos: p, detail: 0 })))

model("grass_tuft",
  [...Array(9)].map((_, i) => cone(0.04, 0.35 + (i % 3) * 0.08, {
    mat: i % 2 ? "grass" : "grassD", sides: 3, pos: [Math.cos(i * 2.4) * 0.12, 0, Math.sin(i * 2.4) * 0.12],
    rot: [Math.sin(i) * 18, i * 40, Math.cos(i) * 18] })))

model("fern",
  [...Array(7)].map((_, i) => tf({ rot: [0, i * 51, 0] },
    tube([0, 0, 0, 0, 0.25, 0.2, 0, 0.3, 0.45], 0.012, { mat: "leafD" }),
    [0.12, 0.24, 0.36].map((z, j) => box(0.18 - j * 0.04, 0.01, 0.06, { mat: j % 2 ? "leafL" : "leaf", pos: [0, 0.22 + j * 0.03, z] })))))

model("flowers",
  [["petalP", 0, 0], ["petalY", 0.15, 0.08], ["petalW", -0.12, 0.1], ["petalB", 0.05, -0.14], ["petalP", -0.1, -0.08]].map(([m, x, z], i) => [
    cyl(0.01, 0.3 + i * 0.03, { mat: "leaf", sides: 4, pos: [x, 0, z] }),
    cyl(0.06, 0.02, { mat: m, sides: 5, pos: [x, 0.3 + i * 0.03, z] }),
    sphere(0.02, { mat: "petalY", detail: 0, pos: [x, 0.33 + i * 0.03, z] })]))

model("reeds",
  [...Array(6)].map((_, i) => cyl(0.012, 0.8 + (i % 3) * 0.15, { mat: "reed", sides: 4,
    pos: [Math.cos(i * 1.9) * 0.1, 0, Math.sin(i * 1.9) * 0.1], rot: [Math.sin(i) * 6, 0, Math.cos(i) * 6] })),
  [0, 2, 4].map(i => cyl(0.03, 0.14, { mat: "cattail", sides: 6, pos: [Math.cos(i * 1.9) * 0.1, 0.62 + (i % 3) * 0.15, Math.sin(i * 1.9) * 0.1] })))

// ---------- fungi
model("mushroom_red",
  cyl(0.06, 0.25, { mat: "stem", sides: 6, top: 0.05 }),
  lathe([0.22, 0, 0.2, 0.06, 0.12, 0.12, 0, 0.14], { mat: "capR", sides: 8, pos: [0, 0.22, 0] }),
  [[0.1, 0.3, 0.08], [-0.08, 0.31, 0.1], [0.02, 0.35, -0.06], [-0.12, 0.29, -0.05]].map(p => sphere(0.022, { mat: "dots", detail: 0, pos: p })))
model("mushroom_cluster",
  [[0, 0, 1], [0.15, 0.08, 0.7], [-0.12, 0.1, 0.55], [0.05, -0.15, 0.45]].map(([x, z, s]) =>
    tf({ pos: [x, 0, z], scale: [s, s, s] },
      cyl(0.04, 0.2, { mat: "stem", sides: 6 }),
      lathe([0.12, 0, 0.1, 0.05, 0, 0.09], { mat: "capB", sides: 7, pos: [0, 0.18, 0] }))))

// ---------- rocks, cliffs
;[[0.5, 3, 0.7], [0.36, 8, 0.6], [0.28, 13, 0.85]].forEach(([r, seed, squash], i) =>
  model("boulder_" + (i + 1), rock(r, { mat: "stone", seed, squash, rough: 0.25 }),
    rock(r * 0.55, { mat: "stoneL", seed: seed + 1, squash: 0.6, pos: [r * 0.45, r * 0.25, r * 0.3] })))
model("mossy_rock",
  rock(0.5, { mat: "stone", seed: 31, squash: 0.65 }),
  rock(0.42, { mat: "moss", seed: 31, squash: 0.25, pos: [0, 0.18, 0] }))
model("cliff_chunk",
  rock(0.9, { mat: "stoneD", seed: 41, squash: 1.3, rough: 0.35 }),
  rock(0.6, { mat: "stone", seed: 42, squash: 1.1, pos: [0.6, -0.2, 0.3] }),
  rock(0.45, { mat: "stoneL", seed: 43, pos: [-0.5, -0.4, 0.4] }))
model("pebbles",
  [...Array(8)].map((_, i) => rock(0.05 + (i % 3) * 0.03, { mat: i % 2 ? "stone" : "stoneL", seed: 50 + i, squash: 0.5,
    pos: [Math.cos(i * 2.2) * 0.3, 0, Math.sin(i * 2.2) * 0.3] })))
model("crystal_cluster",
  [[0, 0, 0, 0.5], [12, 0.08, 20, 0.35], [-15, -0.07, -10, 0.3], [5, 0.02, -25, 0.25]].map(([a, x, b, h]) =>
    cone(0.07, h, { mat: "crystal", sides: 5, pos: [x, 0, x * 0.5], rot: [b, 0, a] })),
  rock(0.15, { mat: "stoneD", seed: 60, squash: 0.4 }))

// ---------- wood debris
model("stump",
  cyl(0.28, 0.35, { mat: "bark", sides: 8, jitter: 0.02 }),
  cyl(0.24, 0.01, { mat: "ring", sides: 8, pos: [0, 0.35, 0] }),
  sym("x", tube([0.2, 0.08, 0, 0.38, 0, 0.05], 0.05, { mat: "bark" })))
model("log",
  cyl(0.18, 1.4, { mat: "bark", sides: 8, rot: [0, 0, 90], pos: [0.7, 0.18, 0], jitter: 0.015 }),
  sym("x", cyl(0.15, 0.01, { mat: "ring", sides: 8, rot: [0, 0, 90], pos: [0.705, 0.18, 0] })),
  rock(0.12, { mat: "moss", seed: 70, squash: 0.3, pos: [0.1, 0.33, 0] }))
model("branch_pile",
  [...Array(6)].map((_, i) => tube([-0.4, 0.03 + i * 0.03, 0, 0, 0.06 + i * 0.03, 0.05, 0.4, 0.03 + i * 0.03, 0], 0.025,
    { mat: i % 2 ? "bark" : "barkD", rot: [0, i * 31, 0] })))

// ---------- water + fire
model("pond",
  cyl(0.9, 0.04, { mat: "water", sides: 10, scale: [1.3, 1, 1] }),
  [...Array(9)].map((_, i) => rock(0.12, { mat: i % 3 ? "stone" : "moss", seed: 80 + i, squash: 0.5,
    pos: [Math.cos(i * 0.7) * 1.2, 0.03, Math.sin(i * 0.7) * 0.92] })),
  [[0.3, 0.2], [-0.35, -0.15]].map(([x, z]) => cyl(0.14, 0.01, { mat: "lily", sides: 7, pos: [x, 0.045, z] })))
model("campfire",
  [0, 72, 144, 216, 288].map(a => tf({ rot: [0, a, 0] }, rock(0.12, { mat: "stoneD", seed: a, pos: [0.35, 0.06, 0] }))),
  [0, 60, 120].map(a => tf({ rot: [0, a, 0] }, cyl(0.04, 0.55, { mat: "bark", sides: 5, rot: [0, 0, 90], pos: [0.27, 0.06, 0] }))),
  cone(0.17, 0.4, { mat: "flame", sides: 5, pos: [0, 0.08, 0], jitter: 0.05, seed: 1 }),
  cone(0.1, 0.5, { mat: "flameL", sides: 5, pos: [0.03, 0.1, 0.02], rot: [0, 30, 4], jitter: 0.05, seed: 2 }),
  cone(0.07, 0.3, { mat: "flame", sides: 4, pos: [-0.08, 0.1, -0.04], rot: [0, 10, -12], seed: 3 }),
  light({ type: "point", color: "#ff9a40", power: 80, pos: [0, 0.8, 0.2] }))

// ---------- dressing scene (kept small: 5 m)
model("glade",
  terrain(5, 5, { res: 16, height: 0.15, fn: (x, z) => 0.5 + 0.5 * Math.sin(x * 1.3) * Math.cos(z), mat: (h) => h > 0.6 ? "grass" : "grassD" }),
  stamp("oak", { pos: [-1.4, 0.05, -1.3] }), stamp("birch", { pos: [1.5, 0.05, -1.5] }),
  stamp("pine", { pos: [0.3, 0.05, -1.9], scale: [0.8, 0.8, 0.8] }),
  stamp("campfire", { pos: [0, 0.08, 0.3] }), stamp("log", { pos: [-1.2, 0.08, 0.6], rot: [0, 20, 0] }),
  stamp("stump", { pos: [1, 0.08, 0.9] }), stamp("boulder_1", { pos: [1.7, 0.25, 0] }),
  stamp("mushroom_cluster", { pos: [-0.8, 0.08, -0.5] }), stamp("flowers", { pos: [0.8, 0.08, 1.7] }),
  scatter("grass_tuft", { area: [-2.3, -2.3, 2.3, 2.3], count: 18, y: 0.07, seed: 9 }))

pack("nature_kit", ["oak", "oak_autumn", "pine", "birch", "dead_tree", "bush", "berry_bush", "grass_tuft", "fern", "flowers",
  "reeds", "mushroom_red", "mushroom_cluster", "boulder_1", "boulder_2", "boulder_3", "mossy_rock", "cliff_chunk", "pebbles",
  "crystal_cluster", "stump", "log", "branch_pile", "pond", "campfire"])
