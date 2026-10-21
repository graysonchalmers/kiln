// Basics: materials, primitives, placement, mirroring, variants, voxels, scatter and packs.
pal({
  bark: "#6b4a34", leaf: "#4f9a4a", leafL: "#7cc25a", stone: "#8a8f9c", wood: "#a8743f", woodD: "#6e4b2c",
  roof: "#b5473a", wall: "#e8dcc2", glass: { color: "#8fd3ff", rough: 0.1, emit: "#ffd28a", glow: 2 },
  iron: { color: "#7a808c", metal: 0.8, rough: 0.35 },
  r: "#c8303c", w: "#f4efe4", s: "#e3d2b0",   // single-char keys for voxels
})

// Boxes, cylinders and cones sit on y = 0, so stacking is just adding heights.
model("tree",
  cyl(0.18, 1.2, { mat: "bark", sides: 6, top: 0.12 }),
  cone(0.9, 1.4, { mat: "leaf", sides: 7, pos: [0, 0.9, 0], jitter: 0.06 }),
  cone(0.7, 1.1, { mat: "leafL", sides: 7, pos: [0, 1.6, 0], jitter: 0.05 }),
  cone(0.45, 0.8, { mat: "leaf", sides: 7, pos: [0, 2.2, 0] }))

model("rock", rock(0.6, { mat: "stone", seed: 3 }))
model("rock_b", rock(0.45, { mat: "stone", seed: 8, squash: 0.6, rough: 0.3 }))

model("crate",
  box(1, 1, 1, "wood"),
  // dark edge planks standing 0.03 proud of the faces (coplanar faces would flicker), mirrored to all 4 corners
  sym("x", sym("z", box(0.12, 1.04, 0.12, { mat: "woodD", pos: [0.47, -0.02, 0.47] }))),
  sym("z", box(1.06, 0.12, 0.12, { mat: "woodD", pos: [0, 0.89, 0.47] }), box(1.06, 0.12, 0.12, { mat: "woodD", pos: [0, -0.01, 0.47] })),
  sym("x", box(0.12, 0.12, 1.06, { mat: "woodD", pos: [0.47, 0.89, 0] }), box(0.12, 0.12, 1.06, { mat: "woodD", pos: [0.47, -0.01, 0] })),
  // diagonal brace on the front and back
  sym("z", box(0.1, 1.07, 0.04, { mat: "woodD", pos: [-0.38, 0.12, 0.515], rot: [0, 0, -45] })))

model("house",
  box(2.4, 1.6, 2, "wall"),
  prism(2.7, 1.1, 2.3, { mat: "roof", pos: [0, 1.6, 0] }),
  box(0.5, 0.9, 0.06, { mat: "woodD", pos: [0, 0, 1.0] }),
  sym("x", box(0.45, 0.45, 0.06, { mat: "glass", pos: [0.75, 0.8, 1.0] })),
  cyl(0.16, 0.8, { mat: "stone", sides: 6, pos: [0.7, 2.0, -0.4] }))

// Voxels: one string per layer, bottom to top; each layer is a top-down map (rows = back to front).
model("mushroom",
  voxels([
    `..s..
     .sss.
     ..s..`,
    `..s..`,
    `.rrr.
     rrwrr
     rrrrr
     rwrrr
     .rrr.`,
    `.....
     .rwr.
     .rrr.
     .....`,
  ], { size: 0.25 }))

model("forest_patch",
  box(6, 0.2, 6, "leaf"),
  scatter("tree", { area: [-2.6, -2.6, 2.6, 2.6], count: 7, scale: [0.6, 1.1], y: 0.2, seed: 4 }),
  scatter("rock*", { area: [-2.6, -2.6, 2.6, 2.6], count: 6, scale: [0.4, 0.8], y: 0.15, seed: 9 }))

pack("kit", ["tree", "rock*", "crate", "house", "mushroom"])
