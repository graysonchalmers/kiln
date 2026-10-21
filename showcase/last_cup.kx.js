// LAST CUP in 3D: the vex/chirp cyberpunk noir coffee shop as a cutaway diorama.
// Meters, Y up, +Z toward the camera. The front wall is cut away; the window is in the back wall.

pal({
  conc: "#3a3f45", concD: "#262a2e", concL: "#4e555c", floor: { color: "#30353a", rough: 0.2 },   // wet concrete
  rust: { color: "#5a2f1d", metal: 0.4, rough: 0.7 }, rustD: "#331a10",
  steel: { color: "#59626a", metal: 0.85, rough: 0.35 }, steelD: { color: "#2b3035", metal: 0.8, rough: 0.5 },
  tower: "#121820", towerD: "#0b0f14",
  winY: { color: "#c9a86a", emit: "#e0b070", glow: 2 }, winC: { color: "#2ee6f2", emit: "#2ee6f2", glow: 3 },
  neonR: { color: "#ff3048", emit: "#ff2040", glow: 8 }, neonC: { color: "#2ee6f2", emit: "#30f0ff", glow: 7 },
  bulb: { color: "#ffd28c", emit: "#ffc070", glow: 10 }, crt: { color: "#1f7a46", emit: "#40ff90", glow: 4 },
  beige: "#6c6a5c", beigeD: "#3b3a33", counterT: { color: "#4c5357", metal: 0.6, rough: 0.3 },
  coat: "#5a4a3a", coatD: "#2e261d", plate: { color: "#9aa2a8", metal: 0.35, rough: 0.5 }, plateD: { color: "#454c52", metal: 0.7, rough: 0.5 },
  eye: { color: "#ff3048", emit: "#ff2040", glow: 6 }, dead: "#08090a", cup: "#bdb6a6", coffee: "#140b07", cable: "#7a2a1e",
  ink: "#1a161d", dress: "#1b1020", skin: "#c9b5b0", stock: "#141016", hair: "#060508", hat: "#08090a",
  ash: "#3a3b3e", ember: { color: "#ff6a2a", emit: "#ff4a1a", glow: 6 },
  bottle: { color: "#0f2a20", rough: 0.15 }, tabletop: { color: "#8a7f72", rough: 0.45 }, menu: "#0c0f10", chalk: { color: "#cfc6a8", emit: "#8a8470", glow: 0.6 },
})

const W = 7, D = 4.5, H = 3.2           // room
const WIN = { x0: -3.2, x1: 0.6, y0: 0.9, y1: 2.7 }

// ------------------------------------------------------------------ room shell

model("_room", { pivot: "origin" },
  box(W, 0.12, D, { mat: "floor", pos: [0, -0.12, 0] }),
  // back wall, built around the window opening
  box(W, WIN.y0, 0.2, { mat: "conc", pos: [0, 0, -D / 2] }),
  box(W, H - WIN.y1, 0.2, { mat: "conc", pos: [0, WIN.y1, -D / 2] }),
  box(WIN.x0 + W / 2, WIN.y1 - WIN.y0, 0.2, { mat: "conc", pos: [(-W / 2 + WIN.x0) / 2, WIN.y0, -D / 2] }),
  box(W / 2 - WIN.x1, WIN.y1 - WIN.y0, 0.2, { mat: "conc", pos: [(WIN.x1 + W / 2) / 2, WIN.y0, -D / 2] }),
  // brutalist panel seams
  [-2.33, 1.17].map((x) => box(0.03, H, 0.02, { mat: "concD", pos: [x, 0, -D / 2 + 0.1] })),
  box(W, 0.03, 0.02, { mat: "concD", pos: [0, 1.55, -D / 2 + 0.11] }),
  // left wall
  box(0.2, H, D, { mat: "conc", pos: [-W / 2, 0, 0] }),
  box(0.02, H, 0.03, { mat: "concD", pos: [-W / 2 + 0.11, 0, 0] }))

// Rusted steel window frame with mullions.
model("_window", { pivot: "origin" },
  box(WIN.x1 - WIN.x0 + 0.16, 0.08, 0.26, { mat: "rust", pos: [(WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.04, -D / 2] }),
  box(WIN.x1 - WIN.x0 + 0.16, 0.08, 0.26, { mat: "rust", pos: [(WIN.x0 + WIN.x1) / 2, WIN.y1 - 0.04, -D / 2] }),
  [WIN.x0, WIN.x0 + (WIN.x1 - WIN.x0) / 3, WIN.x0 + (2 * (WIN.x1 - WIN.x0)) / 3, WIN.x1].map((x) =>
    box(0.08, WIN.y1 - WIN.y0, 0.24, { mat: "rust", pos: [x, WIN.y0, -D / 2] })),
  box(WIN.x1 - WIN.x0, 0.06, 0.22, { mat: "rustD", pos: [(WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2 + 0.2, -D / 2] }),
  box(WIN.x1 - WIN.x0 + 0.3, 0.06, 0.4, { mat: "concL", pos: [(WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.06, -D / 2 + 0.1] }))   // sill

// ------------------------------------------------------------------ the city outside

const r = rng(7)
model("_city", { pivot: "origin" },
  [[-3.6, 4.6, 1.0], [-2.5, 6.2, 0.9], [-1.5, 3.8, 1.1], [-0.4, 7.4, 0.8], [0.6, 5.0, 1.0], [1.7, 6.6, 0.9]].map(([x, h, w], i) => {
    const z = -D / 2 - 1.4 - (i % 3) * 0.9
    const lit = []
    for (let y = 0.6; y < h - 0.3; y += 0.28)
      for (let k = 0; k < 3; k++)
        if (r() < 0.22) lit.push(box(0.12, 0.08, 0.02, { mat: r() < 0.75 ? "winY" : "winC", pos: [x - w / 2 + 0.18 + k * (w - 0.36) / 2, y - 1.5, z + w / 2 + 0.01] }))
    return [box(w, h, w, { mat: i % 2 ? "tower" : "towerD", pos: [x, -1.5, z] }), lit]
  }),
  // neon across the street
  box(0.14, 1.1, 0.06, { mat: "neonR", pos: [-1.0, 1.3, -D / 2 - 1.2] }),
  box(0.9, 0.22, 0.06, { mat: "neonC", pos: [-2.6, 1.7, -D / 2 - 1.5] }),
  light({ color: "#ff2040", power: 60, pos: [-1.0, 1.9, -D / 2 - 0.9] }),
  light({ color: "#30e0ff", power: 50, pos: [-2.6, 1.8, -D / 2 - 1.1] }))

// ------------------------------------------------------------------ the bar

model("_espresso",
  box(0.5, 0.42, 0.36, "steel"), box(0.54, 0.06, 0.4, { mat: "steelD", pos: [0, 0.42, 0] }),
  cyl(0.06, 0.02, { mat: "beige", sides: 10, rot: [90, 0, 0], pos: [-0.14, 0.28, 0.18] }),
  sym("x", cyl(0.025, 0.1, { mat: "steelD", sides: 6, pos: [0.1, 0.06, 0.12] })),
  box(0.12, 0.08, 0.06, { mat: "rust", pos: [0.15, 0.32, 0.18] }))

model("_crt",
  box(0.42, 0.36, 0.38, "beige"),
  box(0.3, 0.22, 0.02, { mat: "crt", pos: [-0.03, 0.07, 0.19] }),
  box(0.36, 0.05, 0.3, { mat: "beigeD", pos: [0, -0.05, 0] }),
  sym("z", cyl(0.012, 0.02, { mat: "beigeD", sides: 6, rot: [90, 0, 0], pos: [0.16, 0.2, 0.19] })),
  light({ color: "#40ff90", power: 6, pos: [0, 0.18, 0.45] }))

model("_counter",
  box(2.6, 1.0, 0.7, "rust"),
  box(2.7, 0.05, 0.8, { mat: "counterT", pos: [0, 1.0, 0] }),
  [-0.9, -0.3, 0.3, 0.9].map((x) => box(0.03, 0.96, 0.02, { mat: "rustD", pos: [x, 0.02, 0.36] })),
  stamp("_espresso", { pos: [-0.7, 1.05, -0.05] }),
  stamp("_crt", { pos: [0.75, 1.05, 0], rot: [0, -15, 0] }))

model("_shelf",
  box(2.4, 0.04, 0.24, "steelD"),
  [-1.0, -0.8, -0.62, -0.4, 0.5, 0.72, 0.95].map((x, i) => cyl(0.04, 0.22 + (i % 3) * 0.05, { mat: "bottle", sides: 6, pos: [x, 0.04, 0] })),
  box(0.9, 0.55, 0.03, { mat: "menu", pos: [0.05, 0.25, -0.1] }),
  [0.62, 0.52, 0.42, 0.32].map((y, i) => box([0.6, 0.45, 0.66, 0.38][i], 0.025, 0.01, { mat: "chalk", pos: [-0.05, y, -0.08] })))

// The pendant lamp: the only warm light in the room.
model("_lamp",
  cyl(0.006, 0.9, { mat: "steelD", sides: 4, pos: [0, 0.2, 0] }),
  lathe([0.22, 0, 0.14, 0.08, 0.05, 0.2, 0.02, 0.22], { mat: "steelD", sides: 10 }),
  sphere(0.05, { mat: "bulb", pos: [0, 0.03, 0], detail: 1 }),
  // Lights sit just under the bulb: inside it, the bulb's own mesh would shadow them.
  light({ type: "spot", color: "#ffbe78", power: 220, pos: [0, -0.1, 0], dir: [0, -1, 0], angle: 50 }),
  light({ color: "#ffbe78", power: 8, pos: [0, -0.1, 0] }))

// COFFEE hangs inside the glass facing the street, so from in here it reads backwards. One F is dead.
const LETTERS = { C: [0,0, 0.3,0, 0.3,0.07, 0.07,0.07, 0.07,0.43, 0.3,0.43, 0.3,0.5, 0,0.5], O: [0,0, 0.3,0, 0.3,0.5, 0,0.5],
  F: [0,0, 0.07,0, 0.07,0.21, 0.24,0.21, 0.24,0.28, 0.07,0.28, 0.07,0.43, 0.3,0.43, 0.3,0.5, 0,0.5],
  E: [0,0, 0.3,0, 0.3,0.07, 0.07,0.07, 0.07,0.21, 0.24,0.21, 0.24,0.28, 0.07,0.28, 0.07,0.43, 0.3,0.43, 0.3,0.5, 0,0.5] }
const letter = (ch, x, mat) => tf({ pos: [x, 0, 0] }, ch === "O"
  ? [box(0.3, 0.07, 0.04, mat), box(0.3, 0.07, 0.04, { mat, pos: [0, 0.43, 0] }), sym("x", box(0.07, 0.5, 0.04, { mat, pos: [0.115, 0, 0] }))]
  : extrude(LETTERS[ch], 0.04, { mat, pos: [-0.15, 0, 0] }))
model("_sign", { pivot: "origin" },
  tf({ scale: [-1, 1, 1] },       // mirrored: we see its back
    ["C", "O", "F", "F", "E", "E"].map((ch, i) => letter(ch, -0.95 + i * 0.38, i === 3 ? "rustD" : "neonR"))),
  sym("x", cyl(0.005, 0.5, { mat: "steelD", sides: 4, pos: [1.0, 0.6, -0.06] })),
  light({ color: "#ff2040", power: 45, pos: [0, 0.25, 0.4] }))

// ------------------------------------------------------------------ the robot

// A cylinder from point a to point b (kiln cylinders grow along +Y; tilt X toward z, then Z toward x).
function limb(a, b, r, mat, sides = 6) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d)
  const t = Math.asin(d[2] / L), p = Math.atan2(-d[0], d[1])
  return cyl(r, L, { mat, sides, pos: a, rot: [t * 180 / Math.PI, 0, p * 180 / Math.PI] })
}

model("_head", { pivot: "origin" },
  box(0.26, 0.24, 0.24, { mat: "plate", pos: [0, 0, 0], jitter: 0.008 }),
  box(0.2, 0.12, 0.02, { mat: "plateD", pos: [0, 0.07, 0.12] }),                 // face plate
  sphere(0.032, { mat: "eye", pos: [-0.05, 0.13, 0.13], detail: 1 }),              // the one working eye
  sphere(0.03, { mat: "dead", pos: [0.05, 0.13, 0.13], detail: 1 }),               // dead glass
  [0.03, 0.05, 0.07].map((y) => box(0.12, 0.008, 0.01, { mat: "dead", pos: [0, y, 0.13] })),   // jaw grille
  sym("x", cyl(0.05, 0.03, { mat: "plateD", sides: 8, rot: [0, 0, 90], pos: [0.13, 0.12, 0] })),
  cyl(0.008, 0.12, { mat: "plateD", sides: 4, rot: [0, 0, 25], pos: [0.06, 0.24, -0.04] }))   // bent antenna

model("_robot", { pivot: "origin" },
  // seated: thighs forward, shins down
  sym("x", [box(0.13, 0.13, 0.42, { mat: "coatD", pos: [0.1, 0.45, 0.12] }), box(0.11, 0.45, 0.11, { mat: "plateD", pos: [0.1, 0, 0.3] }),
    box(0.13, 0.05, 0.2, { mat: "plateD", pos: [0.1, 0, 0.34] })]),
  // slumped coat torso, leaning forward
  tf({ pos: [0, 0.45, 0], rot: [14, 0, 0] },
    lathe([0.2, 0, 0.23, 0.2, 0.25, 0.45, 0.2, 0.6, 0.08, 0.66], { mat: "coat", sides: 7, scale: [1, 1, 0.75], jitter: 0.012 }),
    sym("x", prism(0.12, 0.2, 0.06, { mat: "coatD", pos: [0.1, 0.5, 0.13], rot: [-15, 0, 0] })),   // popped collar
    [-0.03, 0, 0.03].map((x) => cyl(0.012, 0.12, { mat: "cable", sides: 4, pos: [x, 0.6, 0.02] })),
    stamp("_head", { pos: [0, 0.72, 0.03], rot: [4, 38, 6] })),
  // right arm: elbow on the table, mechanical hand around the mug
  limb([0.2, 1.0, 0.14], [0.22, 0.79, 0.42], 0.055, "coat"), limb([0.22, 0.79, 0.42], [0.13, 0.8, 0.53], 0.048, "coat"),
  box(0.07, 0.06, 0.08, { mat: "plate", pos: [0.1, 0.77, 0.56] }),
  // left arm: hand resting flat, still
  limb([-0.2, 1.0, 0.12], [-0.17, 0.78, 0.4], 0.055, "coat"), limb([-0.17, 0.78, 0.4], [-0.12, 0.77, 0.52], 0.048, "coat"),
  box(0.08, 0.025, 0.1, { mat: "plate", pos: [-0.11, 0.765, 0.57] }))

model("_mug", cyl(0.042, 0.09, { mat: "cup", sides: 10, top: 0.046 }), cyl(0.038, 0.002, { mat: "coffee", sides: 10, pos: [0, 0.086, 0] }),
  box(0.012, 0.05, 0.035, { mat: "cup", pos: [0.05, 0.02, 0] }))

model("_ashtray", cyl(0.07, 0.025, { mat: "ash", sides: 8 }),
  cyl(0.006, 0.08, { mat: "cup", sides: 4, rot: [0, 0, 80], pos: [0.04, 0.03, 0] }), sphere(0.008, { mat: "ember", pos: [0.12, 0.045, 0], detail: 0 }),
  light({ color: "#ff5a1a", power: 0.6, pos: [0.12, 0.06, 0] }))

model("_table", { pivot: "origin" },
  cyl(0.06, 0.72, { mat: "steelD", sides: 6 }), cyl(0.28, 0.03, { mat: "steelD", sides: 8 }),
  cyl(0.48, 0.035, { mat: "tabletop", sides: 12, pos: [0, 0.72, 0] }),
  stamp("_mug", { pos: [-0.08, 0.755, 0.12] }), stamp("_ashtray", { pos: [0.24, 0.755, -0.08] }),
  box(0.1, 0.004, 0.07, { mat: "cup", pos: [0.08, 0.756, 0.2], rot: [0, 24, 0] }))

model("_chair", { pivot: "origin" },
  box(0.44, 0.04, 0.42, { mat: "rust", pos: [0, 0.43, 0] }),
  sym("x", sym("z", cyl(0.018, 0.43, { mat: "steelD", sides: 4, pos: [0.19, 0, 0.18] }))),
  box(0.44, 0.45, 0.04, { mat: "rust", pos: [0, 0.47, -0.2], rot: [-6, 0, 0] }))

// ------------------------------------------------------------------ the woman at the window

model("_woman", { pivot: "origin" },
  // legs: one human in a stocking, one exposed steel prosthetic, both in platform boots
  cyl(0.055, 0.42, { mat: "stock", sides: 7, top: 0.065, pos: [-0.07, 0.1, 0] }),
  [cyl(0.03, 0.2, { mat: "plateD", sides: 6, pos: [0.08, 0.32, 0] }), sphere(0.042, { mat: "plate", pos: [0.08, 0.31, 0], detail: 1 }),
    cyl(0.028, 0.2, { mat: "plate", sides: 6, pos: [0.08, 0.1, 0] }), cyl(0.006, 0.2, { mat: "cable", sides: 4, pos: [0.115, 0.12, 0.01] })],
  sym("x", box(0.1, 0.1, 0.16, { mat: "ink", pos: [0.075, 0, 0.02] })),
  // short layered skirt, bodice, bare shoulders, long hair; back to us
  cyl(0.24, 0.17, { mat: "dress", sides: 10, top: 0.13, pos: [0, 0.52, 0], jitter: 0.012 }),
  cyl(0.15, 0.3, { mat: "ink", sides: 8, top: 0.13, pos: [0, 0.68, 0] }),
  cyl(0.12, 0.06, { mat: "skin", sides: 8, top: 0.06, pos: [0, 0.98, 0] }),
  sphere(0.1, { mat: "skin", pos: [0, 1.12, 0.02], detail: 1 }),
  lathe([0.13, 0.7, 0.12, 0.95, 0.12, 1.12, 0.1, 1.2, 0, 1.24], { mat: "hair", sides: 9, pos: [0, 0, -0.03], scale: [1, 1, 0.7] }),
  // raised arm: hand flat on the glass
  limb([0.13, 0.98, 0], [0.2, 1.22, 0.2], 0.03, "skin"), limb([0.2, 1.22, 0.2], [0.22, 1.45, 0.3], 0.032, "ink"),
  box(0.08, 0.11, 0.02, { mat: "ink", pos: [0.22, 1.42, 0.32] }),                // palm on the glass
  cyl(0.028, 0.48, { mat: "ink", sides: 6, rot: [0, 0, -6], pos: [-0.16, 0.5, 0] }))

// The other customer, hunched at the bar with a cigarette.
model("_patron", { pivot: "origin" },
  cyl(0.02, 0.7, { mat: "steelD", sides: 4 }), cyl(0.18, 0.04, { mat: "rust", sides: 8, pos: [0, 0.7, 0] }),
  tf({ pos: [0, 0.74, 0], rot: [28, 0, 0] }, lathe([0.2, 0, 0.22, 0.25, 0.16, 0.5, 0.06, 0.56], { mat: "ink", sides: 7 }),
    sphere(0.1, { mat: "ink", pos: [0, 0.64, 0.04], detail: 1 }),
    cyl(0.17, 0.015, { mat: "hat", sides: 10, pos: [0, 0.7, 0.04] }), cyl(0.09, 0.1, { mat: "hat", sides: 10, pos: [0, 0.71, 0.04] }),
    sphere(0.01, { mat: "ember", pos: [0.05, 0.58, 0.17], detail: 0 })),
  light({ color: "#ff5a1a", power: 0.5, pos: [0.05, 1.3, 0.4] }))

model("last_cup",
  stamp("_room"), stamp("_window"), stamp("_city"),
  stamp("_sign", { pos: [-1.3, 2.05, -D / 2 + 0.28], scale: 0.62 }),
  stamp("_counter", { pos: [2.0, 0, -0.9] }),
  stamp("_shelf", { pos: [2.0, 1.65, -D / 2 + 0.22] }),
  stamp("_lamp", { pos: [0.1, 2.25, 0.5] }),
  stamp("_table", { pos: [0.1, 0, 0.5] }),
  stamp("_chair", { pos: [0.62, 0, 0.52], rot: [0, -90, 0] }),
  stamp("_robot", { pos: [0.6, 0, 0.5], rot: [0, -90, 0] }),
  stamp("_woman", { pos: [-1.9, 0, -D / 2 + 0.38], rot: [0, 180, 0] }),
  stamp("_patron", { pos: [2.6, 0, -0.35], rot: [0, 160, 0] }))
