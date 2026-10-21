// Forest Kit 3D: the vex/chirp Forest Kit as low-poly and voxel game assets.
// Units are meters, Y is up, +Z is the front. Same palette family as the 2D kit.

pal({
  grass: "#74c45a", grassD: "#3d8c48", leaf: "#3d8c48", leafL: "#74c45a", leafD: "#255238",
  bark: "#6e4535", barkD: "#3b2622", dirt: "#6f4337", dirtD: "#40262a",
  stone: "#646985", stoneL: "#a2a7c2", wood: "#9c6a4d", woodD: "#6e4535",
  roof: "#b83a4b", cream: "#f2e6cf", capR: "#d8374c", dots: "#fff8ec",
  gold: { color: "#ffb43a", metal: 0.2, rough: 0.3 }, iron: { color: "#8790ad", metal: 0.8, rough: 0.35 },
  water: { color: "#3e8fd8", rough: 0.08 },
  crystal: { color: "#a678d6", rough: 0.2, emit: "#b98cff", glow: 2.5 },
  flame: { color: "#ff9b2f", emit: "#ffa030", glow: 6 }, flameL: { color: "#ffe86e", emit: "#ffe070", glow: 8 },
  pane: { color: "#ffd28c", emit: "#ffc070", glow: 3 },
  // single-character keys for voxel art
  s: "#f0a882", h: "#a3512b", H: "#5a2a1c", t: "#3b67c0", T: "#22356a", r: "#d8374c", b: "#6e4535",
  g: { color: "#f2a72f", metal: 0.45, rough: 0.35 }, k: "#3b2622", e: "#1d1626", w: "#fff8ec",
  l: "#74c45a", L: "#3d8c48", m: "#9c6a4d", M: "#6e4535", i: "#8790ad",
})

// ------------------------------------------------------------------ voxel characters

// Hero: 8 wide, 6 deep, 13 tall at 10 cm. Layers bottom to top; each layer is a top-down map
// whose bottom row is the front.
const V = (rows) => rows.join("\n")
model("hero", voxels([
  V(["........", "........", ".kk..kk.", ".kk..kk.", ".kk..kk.", "........"]),      // boots
  V(["........", "........", ".TT..TT.", ".TT..TT.", "........", "........"]),      // legs
  V(["........", "........", ".TT..TT.", ".TT..TT.", "........", "........"]),
  V(["........", ".tttttt.", ".tttttt.", ".tttttt.", ".tttttt.", "........"]),      // tunic hem
  V(["........", ".bbbbbb.", "sbbbbbbs", "sbbbbbbs", ".bbggbb.", "........"]),      // belt, hands
  V(["........", ".tttttt.", "tttttttt", "tttttttt", ".tttttt.", "........"]),      // arms
  V(["........", ".tttttt.", "tttttttt", "tttttttt", ".tttttt.", "........"]),
  V(["........", ".rrrrrr.", ".rrrrrr.", ".rrrrrr.", ".rrrrrr.", "...r...."]),      // scarf + tail
  V([".HHHHHH.", ".ssssss.", ".ssssss.", ".ssssss.", ".ssssss.", ".ssssss."]),      // chin
  V([".HHHHHH.", ".hsssssh", ".hssssh.", ".hssssh.", ".ssssss.", ".sesses."]),      // eyes
  V([".HHHHHH.", ".hhhhhh.", ".hssssh.", ".hssssh.", ".hssssh.", ".ssssss."]),
  V([".hhhhhh.", ".hhhhhh.", ".hhhhhh.", ".hhhhhh.", ".hhhhhh.", ".hhhhhh."]),      // bangs
  V(["........", "..hhhh..", ".hhhhhh.", ".hhhhhh.", "..hhhh..", "........"]),
], { size: 0.1 }))

// Slime: an ellipsoid of voxels, darker underside, eyes on the front.
model("slime", voxfn([9, 7, 9], (x, y, z) => {
  const dx = (x - 4) / 4.5, dy = y / 6.5, dz = (z - 4) / 4.5
  if (dx * dx + dy * dy + dz * dz > 1) return null
  if (z === 8 && y === 3 && (x === 3 || x === 5)) return "e"
  if (z === 7 && y === 4 && (x === 3 || x === 5)) return "w"
  return y === 0 ? "L" : "l"
}, { size: 0.08 }))

model("chest", voxels([
  V(["mmmmmmmm", "mmmmmmmm", "mmmmmmmm", "mmmmmmmm", "mmmmmmmm"]),
  V(["MmmmmmmM", "m......m", "m......m", "m......m", "MmmmmmmM"].map((r) => r.replace(/\./g, "m"))),
  V(["MmmmmmmM", "mmmmmmmm", "mmmmmmmm", "mmmmmmmm", "MmmggmmM"]),
  V(["iiiiiiii", "iiiiiiii", "iiiiiiii", "iiiiiiii", "iiiggiii"]),
  V(["MmmmmmmM", "mmmmmmmm", "mmmmmmmm", "mmmmmmmm", "MmmmmmmM"]),
  V([".mmmmmm.", ".mmmmmm.", ".mmmmmm.", ".mmmmmm.", ".mmmmmm."]),
], { size: 0.1 }))

// ------------------------------------------------------------------ low-poly props

model("tree",
  cyl(0.16, 1.1, { mat: "bark", sides: 6, top: 0.1, jitter: 0.02 }),
  sphere(0.62, { mat: "leaf", pos: [0, 1.5, 0], scale: [1, 0.9, 1], jitter: 0.06, seed: 1 }),
  sphere(0.48, { mat: "leafL", pos: [0.32, 1.9, 0.18], jitter: 0.05, seed: 2 }),
  sphere(0.42, { mat: "leafD", pos: [-0.35, 1.25, -0.15], jitter: 0.05, seed: 3 }),
  sphere(0.36, { mat: "leafL", pos: [-0.12, 2.05, -0.25], jitter: 0.04, seed: 4 }))

model("pine",
  cyl(0.12, 0.7, { mat: "barkD", sides: 5 }),
  [[0.8, 0.5, 1.1], [0.62, 1.05, 0.95], [0.44, 1.55, 0.8], [0.26, 2.0, 0.6]].map(([r, y, h], i) =>
    cone(r, h, { mat: i % 2 ? "leaf" : "leafD", sides: 7, pos: [0, y, 0], rot: [0, i * 23, 0], jitter: 0.035, seed: 10 + i })))

;[[0.5, 3, 0.7], [0.36, 8, 0.6], [0.28, 13, 0.85]].forEach(([r, seed, squash], i) =>
  model("rock_" + (i + 1), rock(r, { mat: "stone", seed, squash, rough: 0.25 }),
    rock(r * 0.55, { mat: "stoneL", seed: seed + 1, squash: 0.6, pos: [r * 0.45, r * 0.25, r * 0.3] })))

model("bush",
  sphere(0.4, { mat: "leaf", scale: [1, 0.7, 1], jitter: 0.04, seed: 5 }),
  sphere(0.3, { mat: "leafL", pos: [0.35, 0.05, 0.1], scale: [1, 0.75, 1], jitter: 0.04, seed: 6 }),
  sphere(0.28, { mat: "leafD", pos: [-0.33, 0, -0.08], scale: [1, 0.7, 1], jitter: 0.04, seed: 7 }),
  [[0.15, 0.22, 0.32], [-0.2, 0.15, 0.3], [0.42, 0.18, 0.2]].map((p) => sphere(0.05, { mat: "capR", pos: p, detail: 0 })))

model("mushroom",
  lathe([0.07, 0, 0.06, 0.18, 0.05, 0.3], { mat: "cream", sides: 8 }),
  lathe([0.05, 0.28, 0.24, 0.3, 0.22, 0.38, 0.14, 0.45, 0, 0.48], { mat: "capR", sides: 10 }),
  [[0.1, 0.42, 0.06], [-0.08, 0.43, 0.09], [0.02, 0.46, -0.1], [-0.15, 0.37, -0.06]].map((p) => sphere(0.03, { mat: "dots", pos: p, detail: 0 })))

model("crystals",
  [[0, 0, 0, 0.14, 0.7, 0], [0.16, 0, 0.05, 0.09, 0.45, -18], [-0.14, 0, 0.08, 0.1, 0.5, 16], [0.04, 0, -0.15, 0.08, 0.38, 10]].map(([x, y, z, r, h, tilt]) =>
    tf({ pos: [x, y, z], rot: [tilt * 0.5, 0, tilt] },
      cyl(r, h, { mat: "crystal", sides: 6 }), cone(r, r * 1.6, { mat: "crystal", sides: 6, pos: [0, h, 0] }))),
  rock(0.22, { mat: "stone", seed: 21, squash: 0.4 }))

model("campfire",
  [0, 60, 120, 180, 240, 300].map((a) => tf({ rot: [0, a, 0] }, rock(0.09, { mat: "stone", seed: a + 1, pos: [0.33, 0.03, 0], squash: 0.7 }))),
  [20, 80, 140].map((a) => tf({ rot: [0, a, 0] }, cyl(0.05, 0.55, { mat: "bark", sides: 6, rot: [0, 0, 90], pos: [0.27, 0.06, 0] }))),
  cone(0.2, 0.5, { mat: "flame", sides: 5, pos: [0, 0.05, 0], jitter: 0.03 }),
  cone(0.12, 0.38, { mat: "flameL", sides: 5, pos: [0.02, 0.05, 0.02], rot: [0, 30, 0] }))

model("torch",
  cyl(0.035, 0.8, { mat: "woodD", sides: 6 }),
  cyl(0.06, 0.1, { mat: "iron", sides: 6, top: 0.08, pos: [0, 0.75, 0] }),
  cone(0.07, 0.24, { mat: "flame", sides: 5, pos: [0, 0.85, 0] }), cone(0.04, 0.16, { mat: "flameL", sides: 5, pos: [0, 0.85, 0] }))

model("coin",
  cyl(0.2, 0.05, { mat: "gold", sides: 12, rot: [90, 0, 0], pos: [0, 0.2, 0.025] }),
  extrude([0, 0.1, 0.03, 0.03, 0.1, 0.03, 0.045, -0.015, 0.065, -0.09, 0, -0.045, -0.065, -0.09, -0.045, -0.015, -0.1, 0.03, -0.03, 0.03], 0.07, { mat: "gold", pos: [0, 0.2, 0] }))

model("crate",
  box(0.6, 0.6, 0.6, "wood"),
  sym("x", sym("z", box(0.08, 0.62, 0.08, { mat: "woodD", pos: [0.28, -0.01, 0.28] }))),
  sym("z", box(0.64, 0.08, 0.08, { mat: "woodD", pos: [0, 0.53, 0.28] }), box(0.64, 0.08, 0.08, { mat: "woodD", pos: [0, -0.01, 0.28] })),
  sym("x", box(0.08, 0.08, 0.64, { mat: "woodD", pos: [0.28, 0.53, 0] }), box(0.08, 0.08, 0.64, { mat: "woodD", pos: [0.28, -0.01, 0] })))

model("fence",
  sym("x", [box(0.1, 0.7, 0.1, { mat: "wood", pos: [0.6, 0, 0] }), prism(0.1, 0.07, 0.1, { mat: "wood", pos: [0.6, 0.7, 0] })]),
  box(1.3, 0.08, 0.05, { mat: "woodD", pos: [0, 0.22, 0] }), box(1.3, 0.08, 0.05, { mat: "woodD", pos: [0, 0.5, 0] }))

// A log cabin: stacked logs, gable roof with overhang, a lit window and a door.
model("cabin",
  Array.from({ length: 7 }, (_, i) => [
    cyl(0.12, 2.5, { mat: i % 2 ? "wood" : "woodD", sides: 7, rot: [0, 0, 90], pos: [1.25, 0.12 + i * 0.22, 0.9] }),
    cyl(0.12, 2.5, { mat: i % 2 ? "wood" : "woodD", sides: 7, rot: [0, 0, 90], pos: [1.25, 0.12 + i * 0.22, -0.9] }),
    cyl(0.12, 2.0, { mat: i % 2 ? "woodD" : "wood", sides: 7, rot: [90, 0, 0], pos: [1.15, 0.23 + i * 0.22, -1] }),
    cyl(0.12, 2.0, { mat: i % 2 ? "woodD" : "wood", sides: 7, rot: [90, 0, 0], pos: [-1.15, 0.23 + i * 0.22, -1] }),
  ]),
  box(2.3, 1.5, 1.8, "woodD"),
  prism(2.6, 0.9, 2.4, { mat: "wood", pos: [0, 1.6, 0] }),
  // The prism's ridge runs front to back (along z), so the boards slope off it to the sides:
  // slope 0.9 over 1.3 m = 34.7 degrees, 1.58 m long, mirrored left and right.
  sym("x", box(1.66, 0.08, 2.7, { mat: "roof", pos: [0.66, 2.04, 0], rot: [0, 0, -34.7] })),
  box(0.55, 1.0, 0.08, { mat: "barkD", pos: [-0.45, 0, 1.02] }),
  circle_knob(),
  box(0.5, 0.42, 0.06, { mat: "pane", pos: [0.55, 0.65, 1.02] }),
  box(0.6, 0.06, 0.12, { mat: "barkD", pos: [0.55, 0.6, 1.05] }),
  box(0.3, 1.0, 0.3, { mat: "stone", pos: [0.7, 1.75, -0.45] }))
function circle_knob() { return sphere(0.035, { mat: "gold", pos: [-0.27, 0.5, 1.07], detail: 0 }) }

// ------------------------------------------------------------------ the diorama

// A floating island: tapered dirt lathe, a grass cap, a pond, a stone path and everything above.
model("island",
  lathe([0, -3.4, 0.9, -2.9, 2.0, -1.9, 3.2, -0.9, 3.9, -0.25, 4.1, 0], { mat: "dirt", sides: 14, jitter: 0.12, seed: 3 }),
  lathe([2.4, -1.4, 3.4, -0.6, 3.95, -0.2], { mat: "dirtD", sides: 14, jitter: 0.1, seed: 4, scale: [1.01, 1, 1.01] }),
  cyl(4.15, 0.22, { mat: "grass", sides: 14, jitter: 0.05, seed: 5 }),
  cyl(4.2, 0.08, { mat: "grassD", sides: 14, pos: [0, -0.02, 0], jitter: 0.05, seed: 6 }),
  cyl(1.0, 0.04, { mat: "water", sides: 10, pos: [-1.7, 0.2, 1.2], jitter: 0.03 }),
  [[0.2, 2.6], [0.55, 2.0], [0.65, 1.4], [0.95, 0.85], [0.85, 0.3]].map(([x, z], i) => cyl(0.24, 0.04, { mat: "stoneL", sides: 6, pos: [x, 0.21, z], rot: [0, i * 17, 0] })),
  stamp("cabin", { pos: [1.0, 0.22, -1.4], rot: [0, -12, 0] }),
  stamp("tree", { pos: [-2.4, 0.22, -1.5], scale: 1.25 }), stamp("tree", { pos: [-0.9, 0.22, -2.7], scale: 1.0, rot: [0, 80, 0] }),
  stamp("pine", { pos: [3.0, 0.22, -0.8], scale: 1.1 }), stamp("pine", { pos: [2.7, 0.22, 1.5], scale: 0.85, rot: [0, 40, 0] }),
  stamp("pine", { pos: [-3.2, 0.22, 0.3], scale: 0.9 }),
  stamp("bush", { pos: [-2.6, 0.22, 2.0] }), stamp("bush", { pos: [2.1, 0.22, 0.4], scale: 0.8, rot: [0, 120, 0] }),
  stamp("rock_1", { pos: [-1.0, 0.22, 2.5] }), stamp("rock_2", { pos: [3.3, 0.22, 0.4], rot: [0, 50, 0] }), stamp("rock_3", { pos: [-0.6, 0.22, 1.6] }),
  stamp("crystals", { pos: [-3.0, 0.22, -0.6], rot: [0, 30, 0] }),
  stamp("mushroom", { pos: [-1.6, 0.22, -0.6] }), stamp("mushroom", { pos: [-1.35, 0.22, -0.45], scale: 0.7, rot: [0, 60, 0] }),
  stamp("campfire", { pos: [-0.2, 0.22, 0.2] }),
  stamp("hero", { pos: [0.55, 0.22, 0.55], rot: [0, 28, 0] }),
  stamp("slime", { pos: [-0.9, 0.22, 0.65], rot: [0, 40, 0] }),
  stamp("chest", { pos: [2.25, 0.22, -0.5], rot: [0, -70, 0] }),
  stamp("torch", { pos: [0.2, 0.22, -0.3] }),
  [[-0.9, 1.05, 2.2], [-0.5, 1.2, 2.4], [-0.1, 1.05, 2.5]].map((p, i) => stamp("coin", { pos: p, rot: [0, 20 + i * 15, 0] })),
  [-2.0, -1.2].map((x) => stamp("fence", { pos: [x, 0.22, 3.25], rot: [0, -8, 0] })),
  // rocks hanging under the island
  rock(0.6, { mat: "stone", pos: [1.2, -2.6, 0.6], seed: 40, squash: 1.2 }),
  rock(0.45, { mat: "dirtD", pos: [-1.1, -2.2, -0.8], seed: 41 }))

pack("forest_kit_3d", ["cabin", "tree", "pine", "crystals", "hero", "slime", "chest", "campfire", "torch", "rock_*", "bush", "mushroom", "crate", "fence", "coin"], { cols: 5, spacing: 0.35 })
