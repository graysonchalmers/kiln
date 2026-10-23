// Smoke suite: one model per feature area. 2026-10-22.
pal({
  wood: "#9c6a4d", woodD: "#6e4535", woodL: "#c08a5e",
  stone: "#7a7f96", stoneD: "#5a5e73",
  iron: { color: "#55595f", metal: 0.8, rough: 0.4 },
  gold: { color: "#ffb43a", metal: 0.6, rough: 0.3 },
  red: "#c0393b", cloth: "#e8dcc0",
  grass: "#5a9a48", grassD: "#3f7a38", sand: "#e0cc8a", rockT: "#8a8578", snow: "#f2f4f7",
  leaf: "#3d8c48", leafL: "#74c45a", bark: "#6e4535",
  flame: { color: "#ff9b2f", emit: "#ffa030", glow: 6 },
  glass: { color: "#ffe2a0", emit: "#ffd070", glow: 3 },
  s: "#f0a882", t: "#3b67c0", k: "#3b2622", h: "#6b3b1f", w: "#ffffff", b: "#2a2a35",
})

// 1. Blockout: the classic "1-meter chair" (seat 0.45 m high)
model("chair",
  box(0.45, 0.04, 0.45, { mat: "wood", pos: [0, 0.43, 0] }),
  sym("x", sym("z", box(0.04, 0.43, 0.04, { mat: "woodD", pos: [0.19, 0, 0.19] }))),
  sym("x", box(0.04, 0.55, 0.04, { mat: "woodD", pos: [0.19, 0.47, -0.19] })),
  box(0.42, 0.12, 0.03, { mat: "wood", pos: [0, 0.85, -0.19] }))

// 2. Lathe: barrel with iron hoops
model("barrel",
  lathe([0.25, 0, 0.3, 0.35, 0.25, 0.7], { mat: "wood", sides: 10 }),
  [0.08, 0.6].map(y => cyl(0.265, 0.04, { mat: "iron", sides: 10, pos: [0, y, 0] })),
  cyl(0.255, 0.01, { mat: "woodD", sides: 10, pos: [0, 0.7, 0] }))

// 3. Prism + extrude: market stall with sign
model("stall",
  box(1.6, 0.8, 0.7, { mat: "wood" }),
  box(1.62, 0.04, 0.72, { mat: "woodL", pos: [0, 0.8, 0] }),
  sym("x", box(0.06, 1.6, 0.06, { mat: "woodD", pos: [0.75, 0.8, 0.3] })),
  prism(1.8, 0.4, 0.9, { mat: "red", pos: [0, 2.4, 0.1] }),
  extrude([-0.4, 0, 0.4, 0, 0.45, 0.2, -0.45, 0.2], 0.03, { mat: "cloth", pos: [0, 2.15, 0.56] }))

// 4. Wedge + torus + tube: ramp, ring, pipe
model("ramp", wedge(1, 0.5, 1.5, { mat: "stone" }))
model("ring", torus(0.3, 0.06, { mat: "gold", pos: [0, 0.36, 0] }))
model("pipe",
  tube([0, 0, 0, 0, 0.8, 0, 0.6, 0.8, 0, 0.6, 1.4, 0.4], 0.07, { mat: "iron" }),
  cyl(0.12, 0.05, { mat: "iron", pos: [0, 0, 0] }))

// 5. Rocks with seeds
model("rocks",
  rock(0.5, { mat: "stone", seed: 1, pos: [0, 0.3, 0] }),
  rock(0.3, { mat: "stoneD", seed: 7, squash: 0.6, pos: [0.6, 0.15, 0.2] }),
  rock(0.2, { mat: "stone", seed: 12, rough: 0.4, pos: [-0.5, 0.1, 0.3] }))

// 6. Terrain: island with height/slope materials
model("island", terrain(8, 8, {
  res: 40, height: 2.5,
  fn: (x, z) => Math.max(0, 1 - Math.hypot(x, z) / 3.8) ** 1.5 * (0.8 + 0.2 * Math.sin(x * 2) * Math.cos(z * 2)),
  mat: (h, slope) => h < 0.08 ? "sand" : slope > 0.7 ? "rockT" : h > 0.85 ? "snow" : h > 0.4 ? "grassD" : "grass",
}))

// 7. Voxel character
model("knight", voxels([
  `.b.b.\n.b.b.`,          // feet
  `.t.t.\n.t.t.`,          // legs
  `ttttt\nttttt`,          // body
  `ttttt\nttttt`,
  `s.t.s\n..t..`,          // arms + belt
  `.sss.\n.sss.`,          // head
  `.sks.\n.sss.`,
  `.hhh.\n.hhh.`,          // hair
], { size: 0.1 }))

// 8. Procedural voxels: stepped pyramid
model("ziggurat", voxfn([9, 5, 9], (x, y, z) =>
  Math.max(Math.abs(x - 4), Math.abs(z - 4)) <= 4 - y ? (y % 2 ? "stone" : "stoneD") : null, { size: 0.2 }))

// 9. Light + emissive: lantern
model("lantern",
  cyl(0.03, 1.6, { mat: "iron", sides: 6 }),
  box(0.4, 0.03, 0.03, { mat: "iron", pos: [0.18, 1.58, 0] }),
  cyl(0.09, 0.2, { mat: "glass", sides: 6, pos: [0.35, 1.3, 0] }),
  cone(0.13, 0.1, { mat: "iron", sides: 6, pos: [0.35, 1.5, 0] }),
  light({ type: "point", color: "#ffbe78", power: 60, pos: [0.35, 1.2, 0.2] }))

// 10. Campfire: emissive flames + point light
model("campfire",
  [0, 72, 144, 216, 288].map(a => tf({ rot: [0, a, 0] }, rock(0.12, { mat: "stoneD", seed: a, pos: [0.35, 0.06, 0] }))),
  [0, 60, 120].map(a => tf({ rot: [0, a, 0] }, cyl(0.04, 0.6, { mat: "bark", sides: 5, rot: [0, 0, 80], pos: [0.28, 0.05, 0] }))),
  cone(0.18, 0.45, { mat: "flame", sides: 5, pos: [0, 0.08, 0], jitter: 0.04 }),
  light({ type: "point", color: "#ff9a40", power: 80, pos: [0, 0.8, 0] }))

// 11. Animation: windmill with spinning blades
model("windmill",
  cyl(0.6, 2.4, { mat: "stone", sides: 8, top: 0.45 }),
  cone(0.6, 0.7, { mat: "red", sides: 8, pos: [0, 2.4, 0] }),
  part("blades", { pivot: [0, 2.2, 0.5] },
    [0, 90, 180, 270].map(a => tf({ pos: [0, 2.2, 0.5], rot: [0, 0, a] },
      box(0.18, 1.2, 0.02, { mat: "cloth", pos: [0, 0.15, 0] })))))
animate("windmill", "spin", { frames: 48, fps: 24 }, { blades: { rot: [[0, [0, 0, 0]], [48, [0, 0, 360]]] } })

// 12. Variants + scatter + stamp: a small scene
model("pine",
  cyl(0.1, 0.5, { mat: "bark", sides: 5 }),
  [[0.6, 0.4, 0.9], [0.45, 0.85, 0.8], [0.3, 1.25, 0.65]].map(([r, y, h], i) =>
    cone(r, h, { mat: i % 2 ? "leaf" : "leafL", sides: 7, pos: [0, y, 0], rot: [0, i * 23, 0], jitter: 0.035 })))
model("pine_snow", { base: "pine", swap: { leafL: "snow" } })
model("village",
  terrain(10, 10, { res: 20, height: 0.3, fn: (x, z) => 0.5 + 0.5 * Math.sin(x) * Math.cos(z), mat: () => "grass" }),
  stamp("stall", { pos: [0, 0.2, 0] }),
  stamp("barrel", { pos: [1.2, 0.2, 0.6] }),
  stamp("chair", { pos: [-1, 0.2, 0.8], rot: [0, 30, 0] }),
  stamp("lantern", { pos: [-1.6, 0.2, 0] }),
  scatter("pine", { area: [-4.5, -4.5, 4.5, -2], count: 8, scale: [0.8, 1.2], seed: 4 }))

pack("smoke_kit", ["chair", "barrel", "stall", "ramp", "ring", "pipe", "rocks", "knight", "ziggurat", "lantern", "campfire", "windmill", "pine", "pine_snow"])
