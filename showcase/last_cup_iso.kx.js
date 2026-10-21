// LAST CUP (isometric): the pxl isometric room in 3D. A cutaway cube of a room seen from the
// front-right corner: window in the left wall (x = -S), counter and sign on the back wall (z = -S).
// Meters, Y up, +Z toward the camera.

pal({
  conc: "#4a4d55", concD: "#2e3036", concL: "#62656e", floor: { color: "#34363c", rough: 0.18 },
  rust: { color: "#6a3a22", metal: 0.4, rough: 0.7 }, rustD: "#3a1e12",
  steel: { color: "#6a727a", metal: 0.8, rough: 0.35 }, steelD: { color: "#30353b", metal: 0.75, rough: 0.5 },
  puddle: { color: "#14161a", metal: 0.2, rough: 0.03 }, crack: "#1c1d21", stain: "#3a3c43", rustRun: "#4a2818",
  tower: "#121820", towerD: "#0b0f14", rain: { color: "#8aa0c0", emit: "#6c84a8", glow: 0.6 },
  winY: { color: "#c9a86a", emit: "#e0b070", glow: 2 }, winC: { color: "#2ee6f2", emit: "#2ee6f2", glow: 3 },
  neonR: { color: "#ff3048", emit: "#ff2040", glow: 8 }, neonC: { color: "#2ee6f2", emit: "#30f0ff", glow: 7 },
  bulb: { color: "#ffd28c", emit: "#ffc070", glow: 10 }, crt: { color: "#1f7a46", emit: "#40ff90", glow: 4 },
  beige: "#6c6a5c", beigeD: "#3b3a33", counterT: { color: "#4c5357", metal: 0.6, rough: 0.3 },
  coat: "#5a4a3a", coatD: "#2e261d", patch: "#6e4a2a", plate: { color: "#9aa2a8", metal: 0.35, rough: 0.5 }, plateD: { color: "#454c52", metal: 0.7, rough: 0.5 },
  eye: { color: "#40e8ff", emit: "#30d8ff", glow: 6 }, chest: { color: "#ff3048", emit: "#ff2040", glow: 3 }, dead: "#08090a",
  cup: "#bdb6a6", coffee: "#140b07", cable: "#7a2a1e", wireC: "#1f8a9a", oil: { color: "#050506", metal: 0.3, rough: 0.05 },
  ink: "#1a161d", hood: "#221c1a", ash: "#3a3b3e", ember: { color: "#ff6a2a", emit: "#ff4a1a", glow: 6 },
  tabletop: { color: "#7a6a5a", rough: 0.45 }, smoke: { color: "#a8a8b4", emit: "#3a3a44", glow: 0.5, rough: 1 },
})

const S = 2.6, H = 3.0          // half the room's width, wall height
const WIN = { z0: -2.0, z1: 1.4, y0: 0.85, y1: 2.55 }    // window opening in the left wall

model("_room", { pivot: "origin" },
  box(2 * S, 0.14, 2 * S, { mat: "floor", pos: [0, -0.14, 0] }),
  box(2 * S, 0.06, 2 * S, { mat: "concD", pos: [0, -0.2, 0] }),                       // slab edge
  // back wall, poured panels
  box(2 * S, H, 0.2, { mat: "conc", pos: [0, 0, -S - 0.1] }),
  [-S / 2, 0, S / 2].map((x) => box(0.025, H, 0.02, { mat: "concD", pos: [x, 0, -S + 0.005] })),
  box(2 * S, 0.025, 0.02, { mat: "concD", pos: [0, 1.5, -S + 0.005] }),
  // left wall around the window opening
  box(0.2, WIN.y0, 2 * S, { mat: "conc", pos: [-S - 0.1, 0, 0] }),
  box(0.2, H - WIN.y1, 2 * S, { mat: "conc", pos: [-S - 0.1, WIN.y1, 0] }),
  box(0.2, WIN.y1 - WIN.y0, WIN.z0 + S, { mat: "conc", pos: [-S - 0.1, WIN.y0, (-S + WIN.z0) / 2] }),
  box(0.2, WIN.y1 - WIN.y0, S - WIN.z1, { mat: "conc", pos: [-S - 0.1, WIN.y0, (WIN.z1 + S) / 2] }),
  // wall caps catching light
  box(2 * S + 0.2, 0.03, 0.22, { mat: "concL", pos: [-0.1, H, -S - 0.1] }),
  box(0.22, 0.03, 2 * S, { mat: "concL", pos: [-S - 0.1, H, 0] }))

// Rusted steel frame, mullions and a concrete sill, in the left wall.
model("_window", { pivot: "origin" },
  [WIN.y0, WIN.y1].map((y) => box(0.26, 0.08, WIN.z1 - WIN.z0 + 0.16, { mat: "rust", pos: [-S - 0.1, y - 0.04, (WIN.z0 + WIN.z1) / 2] })),
  [0, 1, 2, 3].map((i) => box(0.24, WIN.y1 - WIN.y0, 0.08, { mat: "rust", pos: [-S - 0.1, WIN.y0, WIN.z0 + (i * (WIN.z1 - WIN.z0)) / 3] })),
  box(0.22, 0.06, WIN.z1 - WIN.z0, { mat: "rustD", pos: [-S - 0.1, (WIN.y0 + WIN.y1) / 2 + 0.15, (WIN.z0 + WIN.z1) / 2] }),
  box(0.4, 0.06, WIN.z1 - WIN.z0 + 0.3, { mat: "concL", pos: [-S + 0.02, WIN.y0 - 0.06, (WIN.z0 + WIN.z1) / 2] }),
  [-1.7, -1.1, -0.3, 0.5, 1.1].map((z, i) => box(0.01, 0.25 + (i % 3) * 0.12, 0.03, { mat: "rustRun", pos: [-S + 0.005, WIN.y0 - 0.35 - (i % 3) * 0.12, z] })))

// The city beyond the glass, and rain that falls past it (seamless: it moves one period per cycle).
const r = rng(7), RAIN_P = 0.9
model("_city", { pivot: "origin" },
  [[-1.9, 5.4, 1.0], [-0.8, 7.0, 0.9], [0.3, 4.4, 1.1], [1.4, 6.6, 0.8], [2.5, 5.0, 1.0]].map(([z, h, w], i) => {
    const x = -S - 1.6 - (i % 3) * 0.9, lit = []
    for (let y = 0.5; y < h - 0.3; y += 0.28)
      for (let k = 0; k < 3; k++)
        if (r() < 0.2) lit.push(box(0.02, 0.08, 0.12, { mat: r() < 0.75 ? "winY" : "winC", pos: [x + w / 2 + 0.01, y - 1.5, z - w / 2 + 0.18 + (k * (w - 0.36)) / 2] }))
    return [box(w, h, w, { mat: i % 2 ? "tower" : "towerD", pos: [x, -1.5, z] }), lit]
  }),
  box(0.06, 0.2, 0.8, { mat: "neonC", pos: [-S - 1.3, 2.0, -0.6] }),            // a sign across the street, half dead
  light({ color: "#4a6cff", power: 160, pos: [-S - 0.9, 2.2, -0.2] }),           // cold city light through the glass
  light({ color: "#30e0ff", power: 40, pos: [-S - 1.0, 2.0, -0.6] }),
  part("rain", { pivot: [-S - 0.6, 0, 0] },
    Array.from({ length: 110 }, () => {
      const z = -2.4 + r() * 5, y = -0.6 + r() * 4.4, x = -S - 0.3 - r() * 0.9
      return box(0.008, 0.22, 0.008, { mat: "rain", pos: [x, y, z], rot: [10, 0, 0] })
    }).concat(Array.from({ length: 110 }, (_, i) => box(0.008, 0.22, 0.008, { mat: "rain", pos: [-S - 0.3 - r() * 0.9, 3.8 + r() * RAIN_P, -2.4 + r() * 5], rot: [10, 0, 0] })))))

// ------------------------------------------------------------------ the bar

model("_espresso",
  box(0.5, 0.42, 0.36, "steel"), box(0.54, 0.06, 0.4, { mat: "steelD", pos: [0, 0.42, 0] }),
  cyl(0.06, 0.02, { mat: "beige", sides: 10, rot: [90, 0, 0], pos: [-0.14, 0.28, 0.18] }),
  sym("x", cyl(0.025, 0.1, { mat: "steelD", sides: 6, pos: [0.1, 0.06, 0.12] })),
  box(0.12, 0.08, 0.06, { mat: "rust", pos: [0.15, 0.32, 0.18] }),
  sphere(0.012, { mat: "neonR", pos: [0.18, 0.36, 0.19], detail: 0 }))

model("_crt",
  box(0.42, 0.36, 0.38, "beige"),
  box(0.3, 0.22, 0.02, { mat: "crt", pos: [-0.03, 0.07, 0.19] }),
  box(0.36, 0.05, 0.3, { mat: "beigeD", pos: [0, -0.05, 0] }),
  light({ color: "#40ff90", power: 6, pos: [0, 0.18, 0.45] }))

model("_counter",
  box(3.0, 1.0, 0.7, "rust"),
  box(3.1, 0.05, 0.8, { mat: "counterT", pos: [0, 1.0, 0] }),
  [-1.0, -0.3, 0.4, 1.1].map((x) => box(0.03, 0.96, 0.02, { mat: "rustD", pos: [x, 0.02, 0.36] })),
  // kick-plate neon with a dead stretch
  box(2.1, 0.03, 0.03, { mat: "neonR", pos: [-0.45, 0.06, 0.37] }), box(0.5, 0.03, 0.03, { mat: "rustD", pos: [0.85, 0.06, 0.37] }),
  box(0.3, 0.03, 0.03, { mat: "neonR", pos: [1.3, 0.06, 0.37] }),
  light({ color: "#ff2040", power: 30, pos: [-0.4, 0.15, 0.75] }), light({ color: "#ff2040", power: 14, pos: [1.2, 0.15, 0.75] }),
  stamp("_crt", { pos: [-0.9, 1.05, 0], rot: [0, 20, 0] }),
  stamp("_espresso", { pos: [0.4, 1.05, -0.05] }),
  stamp("_mug", { pos: [1.15, 1.05, 0.1] }), stamp("_mug", { pos: [1.3, 1.05, -0.08], rot: [0, 70, 0] }))

model("_stool", { pivot: "origin" },
  cyl(0.02, 0.72, { mat: "steelD", sides: 5 }), cyl(0.16, 0.02, { mat: "steelD", sides: 6 }),
  cyl(0.17, 0.05, { mat: "rust", sides: 8, pos: [0, 0.72, 0] }), cyl(0.12, 0.015, { mat: "steelD", sides: 6, pos: [0, 0.28, 0] }))

// CAFE, top to bottom, on the back wall. The F flickers (a dark tube under a lit copy that blinks).
const L = { C: [0,0, 0.3,0, 0.3,0.07, 0.07,0.07, 0.07,0.43, 0.3,0.43, 0.3,0.5, 0,0.5],
  F: [0,0, 0.07,0, 0.07,0.21, 0.24,0.21, 0.24,0.28, 0.07,0.28, 0.07,0.43, 0.3,0.43, 0.3,0.5, 0,0.5],
  E: [0,0, 0.3,0, 0.3,0.07, 0.07,0.07, 0.07,0.21, 0.24,0.21, 0.24,0.28, 0.07,0.28, 0.07,0.43, 0.3,0.43, 0.3,0.5, 0,0.5] }
model("_sign", { pivot: "origin" },
  box(0.5, 2.3, 0.05, { mat: "ink", pos: [0, -0.05, -0.04] }),
  [[-0.24, 0], [0.24, 0]].map(([x]) => box(0.025, 2.3, 0.025, { mat: "rustD", pos: [x, -0.05, 0] })),
  ["C", "A", "F", "E"].map((ch, i) => {
    const y = 1.65 - i * 0.55
    return ch === "F"
      ? [extrude(L.F, 0.03, { mat: "rustD", pos: [-0.15, y, -0.005] }), part("flicker", { pivot: [0, y + 0.25, 0] }, extrude(L.F, 0.035, { mat: "neonR", pos: [-0.15, y, 0] }))]
      : ch === "A"
        ? [sym("x", box(0.07, 0.5, 0.035, { mat: "neonR", pos: [0.115, y, 0] })), box(0.3, 0.07, 0.035, { mat: "neonR", pos: [0, y + 0.43, 0] }),
           box(0.16, 0.07, 0.035, { mat: "neonR", pos: [0, y + 0.21, 0] })]
        : extrude(L[ch], 0.035, { mat: "neonR", pos: [-0.15, y, 0] })
  }),
  light({ color: "#ff2040", power: 70, pos: [0, 1.0, 0.5] }))

model("_tube", { pivot: "origin" },
  cyl(0.025, 3.6, { mat: "neonC", sides: 6, rot: [0, 0, 90], pos: [1.8, 0, 0] }),
  [0.2, 1.4, 2.6, 3.5].map((x) => box(0.04, 0.1, 0.06, { mat: "rustD", pos: [x - 1.8 + 1.8, -0.05, -0.03] })),
  [0.9, 2.6].map((x) => light({ color: "#30e0ff", power: 40, pos: [x, -0.25, 0.35] })))

// The bulb over his table, swinging a little.
model("_lamp", part("sway", { pivot: [0, 1.6, 0] },
  cyl(0.006, 1.4, { mat: "steelD", sides: 4, pos: [0, 0.2, 0] }),
  lathe([0.2, 0, 0.13, 0.08, 0.05, 0.2, 0.02, 0.22], { mat: "steelD", sides: 10 }),
  sphere(0.05, { mat: "bulb", pos: [0, 0.03, 0], detail: 1 }),
  light({ type: "spot", color: "#ffbe78", power: 200, pos: [0, -0.1, 0], dir: [0, -1, 0], angle: 55 }),
  light({ color: "#ffbe78", power: 10, pos: [0, -0.1, 0] })))

// ------------------------------------------------------------------ the robot

function limb(a, b, rad, mat, sides = 6) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d)
  const t = Math.asin(d[2] / len), p = Math.atan2(-d[0], d[1])
  return cyl(rad, len, { mat, sides, pos: a, rot: [t * 180 / Math.PI, 0, p * 180 / Math.PI] })
}

// Cracked visor, one eye left, mouth grille, rivets, a snapped antenna, an amber ear light.
model("_head", { pivot: "origin" },
  box(0.26, 0.24, 0.24, { mat: "plate", jitter: 0.008 }),
  box(0.22, 0.07, 0.02, { mat: "dead", pos: [0, 0.11, 0.12] }),                 // visor band
  sphere(0.026, { mat: "eye", pos: [-0.06, 0.145, 0.13], detail: 1 }),
  [[-0.01, 0.16, 25], [0.03, 0.13, -35], [0.06, 0.15, 60]].map(([x, y, a]) => box(0.045, 0.006, 0.006, { mat: "plate", pos: [x, y, 0.132], rot: [0, 0, a] })),   // cracks in the visor
  [0.03, 0.05, 0.07].map((y) => box(0.12, 0.008, 0.01, { mat: "dead", pos: [0, y, 0.122] })),   // grille
  sym("x", cyl(0.05, 0.03, { mat: "plateD", sides: 8, rot: [0, 0, 90], pos: [0.13, 0.12, 0] })),
  sphere(0.01, { mat: "winY", pos: [0.15, 0.12, 0], detail: 0 }),
  [[-0.1, 0.2], [0.1, 0.2], [-0.1, 0.02], [0.1, 0.02]].map(([x, y]) => sphere(0.008, { mat: "plateD", pos: [x, y, 0.121], detail: 0 })),
  box(0.06, 0.04, 0.01, { mat: "plateD", pos: [0.07, 0.19, 0.12], rot: [0, 0, 12] }),                    // a dent hammered flat
  cyl(0.008, 0.1, { mat: "plateD", sides: 4, rot: [0, 0, 35], pos: [0.06, 0.24, -0.04] }))

model("_mug", cyl(0.042, 0.09, { mat: "cup", sides: 10, top: 0.046 }), cyl(0.038, 0.002, { mat: "coffee", sides: 10, pos: [0, 0.086, 0] }),
  box(0.012, 0.05, 0.035, { mat: "cup", pos: [0.05, 0.02, 0] }))

model("_robot", { pivot: "origin" },
  // seated: thighs forward, shins down; the right shin is a bare piston with a hose
  box(0.13, 0.13, 0.42, { mat: "coatD", pos: [-0.1, 0.45, 0.12] }), box(0.11, 0.45, 0.11, { mat: "plateD", pos: [-0.1, 0, 0.3] }),
  box(0.13, 0.13, 0.42, { mat: "coatD", pos: [0.1, 0.45, 0.12] }),
  sphere(0.06, { mat: "plate", pos: [0.1, 0.47, 0.32], detail: 1 }),
  cyl(0.035, 0.42, { mat: "plateD", sides: 6, pos: [0.1, 0.02, 0.3] }), cyl(0.016, 0.36, { mat: "steel", sides: 5, pos: [0.15, 0.04, 0.3] }),
  limb([0.05, 0.4, 0.34], [0.06, 0.08, 0.36], 0.008, "ink", 4),
  sym("x", box(0.13, 0.05, 0.2, { mat: "plateD", pos: [0.1, 0, 0.34] })),
  cyl(0.06, 0.002, { mat: "oil", sides: 10, pos: [0.16, 0.001, 0.42] }),                                    // weeping oil
  // slumped coat torso with a sewn patch and a tear over a chest light
  tf({ pos: [0, 0.45, 0], rot: [14, 0, 0] },
    lathe([0.2, 0, 0.23, 0.2, 0.25, 0.45, 0.2, 0.6, 0.08, 0.66], { mat: "coat", sides: 7, scale: [1, 1, 0.75], jitter: 0.012 }),
    sym("x", prism(0.12, 0.2, 0.06, { mat: "coatD", pos: [0.1, 0.5, 0.13], rot: [-15, 0, 0] })),
    box(0.1, 0.1, 0.02, { mat: "patch", pos: [0.12, 0.25, -0.15], rot: [0, 160, 0] }),
    box(0.04, 0.06, 0.02, { mat: "dead", pos: [-0.05, 0.4, 0.17] }), sphere(0.014, { mat: "chest", pos: [-0.05, 0.43, 0.175], detail: 0 }),
    [[-0.03, "cable"], [0, "wireC"], [0.03, "cable"]].map(([x, m]) => cyl(0.012, 0.12, { mat: m, sides: 4, pos: [x, 0.6, 0.02] })),
    stamp("_head", { pos: [0, 0.72, 0.03], rot: [8, 30, 6] })),
  // right arm, rigged to lift the cup
  part("upper", { pivot: [0.2, 1.0, 0.14] }, limb([0.2, 1.0, 0.14], [0.22, 0.79, 0.42], 0.055, "coat"),
    part("fore", { pivot: [0.22, 0.79, 0.42] }, limb([0.22, 0.79, 0.42], [0.13, 0.8, 0.53], 0.048, "coat"),
      part("cup", { pivot: [0.12, 0.78, 0.55] },
        box(0.07, 0.06, 0.08, { mat: "plate", pos: [0.1, 0.77, 0.56] }),
        stamp("_mug", { pos: [0.12, 0.755, 0.58] })))),
  limb([-0.2, 1.0, 0.12], [-0.17, 0.78, 0.4], 0.055, "coat"), limb([-0.17, 0.78, 0.4], [-0.12, 0.77, 0.52], 0.048, "coat"),
  box(0.08, 0.025, 0.1, { mat: "plate", pos: [-0.11, 0.765, 0.57] }))

model("_chair", { pivot: "origin" },
  box(0.44, 0.04, 0.42, { mat: "rust", pos: [0, 0.43, 0] }),
  sym("x", sym("z", cyl(0.018, 0.43, { mat: "steelD", sides: 4, pos: [0.19, 0, 0.18] }))),
  box(0.44, 0.45, 0.04, { mat: "rust", pos: [0, 0.47, -0.2], rot: [-6, 0, 0] }))

model("_ashtray", cyl(0.07, 0.025, { mat: "ash", sides: 8 }),
  cyl(0.006, 0.08, { mat: "cup", sides: 4, rot: [0, 0, 80], pos: [0.04, 0.03, 0] }), sphere(0.008, { mat: "ember", pos: [0.12, 0.045, 0], detail: 0 }),
  light({ color: "#ff5a1a", power: 0.6, pos: [0.12, 0.06, 0] }),
  part("smoke", { pivot: [0.12, 0.06, 0] }, [0.12, 0.24, 0.38, 0.52].map((y, i) => sphere(0.02 + i * 0.012, { mat: "smoke", pos: [0.12 + Math.sin(i * 1.7) * 0.03, 0.06 + y, 0], detail: 0 }))))

model("_table", { pivot: "origin" },
  cyl(0.06, 0.72, { mat: "steelD", sides: 6 }), cyl(0.28, 0.03, { mat: "steelD", sides: 8 }),
  cyl(0.48, 0.035, { mat: "tabletop", sides: 12, pos: [0, 0.72, 0] }))

// A hooded drinker asleep on the counter, a cigarette burning between two fingers.
model("_sleeper", { pivot: "origin" },
  stamp("_stool"),
  tf({ pos: [0, 0.76, 0], rot: [-52, 0, 0] },
    lathe([0.2, 0, 0.22, 0.25, 0.17, 0.5, 0.07, 0.56], { mat: "hood", sides: 7, jitter: 0.01 }),
    sphere(0.12, { mat: "hood", pos: [0, 0.62, -0.02], detail: 1, scale: [1, 0.9, 1.1] })),
  sym("x", limb([0.2, 1.0, -0.2], [0.12, 1.05, -0.55], 0.05, "hood")),
  cyl(0.004, 0.07, { mat: "cup", sides: 4, rot: [90, 0, 0], pos: [0.14, 1.06, -0.62] }), sphere(0.008, { mat: "ember", pos: [0.14, 1.06, -0.69], detail: 0 }),
  light({ color: "#ff5a1a", power: 0.5, pos: [0.14, 1.12, -0.6] }))

model("last_cup_iso", { pivot: "origin" },
  stamp("_room"), stamp("_window"), stamp("_city"),
  light({ color: "#6c8cff", power: 22, pos: [-S + 0.35, 1.6, 0.1] }),          // cold light just inside the glass
  stamp("_counter", { pos: [0.75, 0, -2.2] }),
  stamp("_sign", { pos: [-1.75, 0.55, -S + 0.06], scale: 0.55 }),
  stamp("_tube", { pos: [-1.1, 2.75, -S + 0.05] }),
  stamp("_stool", { pos: [-0.3, 0, -1.35] }), stamp("_stool", { pos: [0.6, 0, -1.35] }),
  stamp("_sleeper", { pos: [1.65, 0, -1.3] }),
  // his table by the window
  stamp("_lamp", { pos: [-1.4, 2.35, 0] }),
  stamp("_table", { pos: [-1.4, 0, 0] }),
  stamp("_chair", { pos: [-0.88, 0, 0.02], rot: [0, -90, 0] }),
  stamp("_robot", { pos: [-0.9, 0, 0], rot: [0, -90, 0] }),
  // the abandoned table: a tipped cup, a full ashtray
  stamp("_table", { pos: [0.9, 0, 1.3] }),
  stamp("_ashtray", { pos: [1.05, 0.755, 1.2] }),
  stamp("_mug", { pos: [0.75, 0.755, 1.45] }),
  tf({ pos: [0.85, 0.8, 1.15], rot: [0, 30, 90] }, stamp("_mug")),
  // what's left of another robot, under the window
  tf({ pos: [-2.15, 0.12, 1.9], rot: [0, 120, 70] }, stamp("_head", { swap: { eye: "dead" } })),
  limb([-2.1, 0.02, 1.75], [-1.7, 0.01, 1.4], 0.012, "cable", 4),
  // the CRT's cable across the floor to his table
  limb([-1.05, 0.02, -1.85], [-1.2, 0.02, -0.6], 0.015, "ink", 4), limb([-1.2, 0.02, -0.6], [-1.35, 0.02, -0.1], 0.015, "ink", 4),
  // standing water, cracks, stains, rust runs
  box(1.4, 0.004, 0.9, { mat: "puddle", pos: [-0.9, 0, 1.6], rot: [0, 20, 0] }),
  box(1.1, 0.004, 0.7, { mat: "puddle", pos: [1.2, 0, -0.3], rot: [0, -15, 0] }),
  [[0.2, 0.4, 30, 0.9], [0.4, 0.7, -40, 0.5], [-1.9, -1.2, 10, 0.8], [1.9, 1.9, 60, 0.7]].map(([x, z, a, l]) => box(l, 0.003, 0.02, { mat: "crack", pos: [x, 0.001, z], rot: [0, a, 0] })),
  [-2.4, -2.0, -1.3, -0.7, 0.4, 1.2, 1.9, 2.3].map((z, i) => box(0.01, 0.3 + (i % 4) * 0.22, 0.05, { mat: "stain", pos: [-S + 0.005, H - 0.3 - (i % 4) * 0.22, z] })),
  [-0.9, 0.3, 1.5, 2.4].map((x, i) => box(0.04, 0.3 + (i % 3) * 0.25, 0.01, { mat: "rustRun", pos: [x, 2.4 - (i % 3) * 0.25, -S + 0.005] })))

// 10 s at 24 fps: rain falls past the glass, the F dies and re-strikes, smoke rises,
// the bulb sways, and he lifts the cup once.
const rainKeys = []
for (let i = 0; i < 10; i++) rainKeys.push([i * 24, [0, 0, 0], "linear"], [i * 24 + 23, [0, (-RAIN_P * 23) / 24, 0], "step"])
rainKeys.push([240, [0, 0, 0]])
const smokeKeys = []
for (let i = 0; i < 4; i++) smokeKeys.push([i * 60, [0, 0, 0], "linear"], [i * 60 + 59, [0.02, 0.2, 0], "step"])
smokeKeys.push([240, [0, 0, 0]])
animate("last_cup_iso", "night", { frames: 240, fps: 24 }, {
  rain: { move: rainKeys },
  smoke: { move: smokeKeys },
  upper: { rot: [[0, [0, 0, 0]], [48, [0, 0, 0]], [110, [0, 0, -60]], [160, [0, 0, -60]], [214, [0, 0, 0]], [240, [0, 0, 0]]] },
  fore: { rot: [[0, [0, 0, 0]], [48, [0, 0, 0]], [110, [0, 0, -78]], [124, [0, 0, -85]], [150, [0, 0, -85]], [160, [0, 0, -78]], [214, [0, 0, 0]], [240, [0, 0, 0]]] },
  cup: { rot: [[0, [0, 0, 0]], [48, [0, 0, 0]], [110, [0, 0, 138]], [124, [0, 0, 125]], [150, [0, 0, 125]], [160, [0, 0, 138]], [214, [0, 0, 0]], [240, [0, 0, 0]]] },
  sway: { rot: [[0, [1.2, 0, 0.6]], [60, [-1, 0, -0.5]], [120, [1.2, 0, 0.6]], [180, [-1, 0, -0.5]], [240, [1.2, 0, 0.6]]] },
  flicker: { scale: [[0, 1, "step"], [50, 0.001, "step"], [53, 1, "step"], [56, 0.001, "step"], [62, 1, "step"], [130, 0.001, "step"],
    [133, 1, "step"], [190, 0.001, "step"], [204, 1, "step"], [207, 0.001, "step"], [210, 1]] },
})
