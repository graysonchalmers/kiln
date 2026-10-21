// THE DRAGON'S HOARD: a vault diorama textured with loom materials (seamless PBR maps).
// Meters, Y up, +Z toward the camera. A cutaway room: back wall (z = -S) with an arched niche,
// left wall (x = -S) with an iron door. Lit by a lava pit, two torches and a glow from the egg.
// Textures come from ../../loom/showcase/textures1k (build them with loom first).

const T = "../../loom/showcase/textures1k/"
pal({
  cobble: { tex: T + "wet_cobblestone", uv: 1.1 },
  brick: { tex: T + "brick_wall", uv: 1.5 },
  brickDark: { tex: T + "brick_wall", uv: 1.5, color: "#8a8078" },
  conc: { tex: T + "stained_concrete", uv: 1.4 },
  wood: { tex: T + "wood_planks", uv: 0.9 },
  iron: { tex: T + "rusty_panels", uv: 0.7 },
  ironFine: { tex: T + "rusty_panels", uv: 0.3 },
  lava: { tex: T + "lava_rock", uv: 0.9, glow: 2.6 },
  scales: { tex: T + "dragon_scales", uv: 0.28 },
  gold: { tex: T + "hammered_gold", uv: 0.12 },
  goldBig: { tex: T + "hammered_gold", uv: 0.3 },
  soot: "#1a1614",
  flame: { color: "#ffb04a", emit: "#ff8a2a", glow: 14 },
  ember: { color: "#ff6a1a", emit: "#ff5a10", glow: 8 },
  rune: { color: "#5af0d0", emit: "#40e8c8", glow: 6 },
  gem: { color: "#c0203a", rough: 0.08, metal: 0.1 },
  gemB: { color: "#2a5ad0", rough: 0.08, metal: 0.1 },
})

const S = 2.6, H = 3.2
const NICHE = { x: 0.35, w: 1.5, h: 2.15, d: 0.7 }       // the arched niche in the back wall
const PIT = { x: -1.2, z: 1.25, w: 1.5, d: 1.1 }             // the lava pit in the floor

// ------------------------------------------------------------------ the room

// The back wall's outline goes around the arch (an opening at the floor), so one extrusion does it.
function archWall(x0, x1, cx, w, h, seg = 14) {
  const r = w / 2, spring = h - r, pts = [[x0, 0], [x0, H], [x1, H], [x1, 0], [cx + r, 0], [cx + r, spring]]
  for (let i = 1; i < seg; i++) { const a = (i / seg) * Math.PI; pts.push([cx + Math.cos(a) * r, spring + Math.sin(a) * r]) }
  pts.push([cx - r, spring], [cx - r, 0])
  return pts.flat()
}

model("_room", { pivot: "origin" },
  // the floor, in four pieces around the lava pit
  (() => {
    const x0 = PIT.x - PIT.w / 2, x1 = PIT.x + PIT.w / 2, z0 = PIT.z - PIT.d / 2, z1 = PIT.z + PIT.d / 2
    const slab = (ax, bx, az, bz) => box(bx - ax, 0.2, bz - az, { mat: "cobble", pos: [(ax + bx) / 2, -0.2, (az + bz) / 2] })
    return [slab(-S, S, -S, z0), slab(-S, S, z1, S), slab(-S, x0, z0, z1), slab(x1, S, z0, z1)]
  })(),
  box(PIT.w, 0.25, PIT.d, { mat: "soot", pos: [PIT.x, -0.45, PIT.z] }),     // the pit's dark bottom
  // back wall with the arch, and the niche behind it
  extrude(archWall(-S, S, NICHE.x, NICHE.w, NICHE.h), 0.3, { mat: "brick", pos: [0, 0, -S - 0.15] }),
  box(NICHE.w + 0.3, NICHE.h, 0.2, { mat: "brickDark", pos: [NICHE.x, 0, -S - 0.3 - NICHE.d] }),
  [-1, 1].map((sx) => box(0.15, NICHE.h, NICHE.d, { mat: "brickDark", pos: [NICHE.x + sx * (NICHE.w / 2 + 0.075), 0, -S - 0.3 - NICHE.d / 2] })),
  // left wall
  box(0.3, H, 2 * S, { mat: "brick", pos: [-S - 0.15, 0, 0] }),
  // a stained-concrete plinth along both walls, and caps on top
  box(2 * S, 0.42, 0.12, { mat: "conc", pos: [0, 0, -S + 0.06] }),
  box(0.12, 0.42, 2 * S, { mat: "conc", pos: [-S + 0.06, 0, 0] }),
  box(2 * S + 0.3, 0.1, 0.42, { mat: "conc", pos: [-0.15, H, -S - 0.15] }),
  box(0.42, 0.1, 2 * S, { mat: "conc", pos: [-S - 0.15, H, 0] }),
  // keystone and arch trim
  box(0.24, 0.32, 0.08, { mat: "conc", pos: [NICHE.x, NICHE.h - 0.1, -S + 0.04] }))

// ------------------------------------------------------------------ the egg in the niche

model("_pedestal", { pivot: "origin" },
  cyl(0.5, 0.18, { mat: "conc", sides: 10 }),
  cyl(0.38, 0.5, { mat: "conc", sides: 10, top: 0.3, pos: [0, 0.18, 0] }),
  cyl(0.44, 0.1, { mat: "conc", sides: 10, pos: [0, 0.68, 0] }),
  // a shallow bowl of embers the egg sits in
  cyl(0.36, 0.06, { mat: "iron", sides: 12, top: 0.42, pos: [0, 0.78, 0] }),
  [0, 1, 2, 3, 4, 5, 6].map((i) => sphere(0.035, { mat: "ember", pos: [Math.cos(i * 0.9) * 0.22, 0.85, Math.sin(i * 0.9) * 0.22], detail: 0 })))

model("_egg", { pivot: "origin" },
  lathe([0, 0, 0.18, 0.04, 0.3, 0.2, 0.33, 0.42, 0.28, 0.66, 0.16, 0.84, 0, 0.92], { mat: "scales", sides: 18 }))

// faint runes on the niche back, glowing
model("_runes", { pivot: "origin" },
  [[-0.45, 1.5], [-0.25, 1.75], [0, 1.85], [0.25, 1.75], [0.45, 1.5]].map(([x, y]) => box(0.05, 0.16, 0.02, { mat: "rune", pos: [x, y, 0], rot: [0, 0, x * 40] })))

// ------------------------------------------------------------------ the lava pit

model("_lavapit", { pivot: "origin" },
  box(1.5, 0.05, 1.1, { mat: "lava", pos: [0, -0.14, 0] }),
  // a rim of concrete blocks, broken in places
  ...[[-0.8, 0, 0.1, 1.3], [0.8, 0, 0.1, 1.3], [0, -0.6, 1.7, 0.1], [0, 0.6, 1.7, 0.1]].map(([x, z, w, d]) => box(w, 0.08, d, { mat: "conc", pos: [x, -0.02, z] })),
  rock(0.12, { mat: "conc", pos: [0.55, 0.02, 0.62], seed: 3, squash: 0.6 }),
  // lights just above the surface: lava lights the room from below
  light({ color: "#ff6a20", power: 170, pos: [-0.3, 0.35, 0] }),
  light({ color: "#ff8a30", power: 110, pos: [0.45, 0.3, 0.1] }))

// ------------------------------------------------------------------ the hoard

model("_coin", cyl(0.055, 0.012, { mat: "gold", sides: 12 }))
model("_goblet", { pivot: "bottom" },
  lathe([0.05, 0, 0.05, 0.015, 0.012, 0.03, 0.012, 0.12, 0.06, 0.16, 0.07, 0.24], { mat: "goldBig", sides: 12 }),
  sphere(0.016, { mat: "gem", pos: [0, 0.2, 0.068], detail: 0 }))
model("_hoard", { pivot: "origin" },
  lathe([0.95, 0, 0.7, 0.12, 0.4, 0.24, 0, 0.3], { mat: "goldBig", sides: 16, scale: [1, 1, 0.8] }),
  scatter("_coin", { area: [-0.9, -0.7, 0.9, 0.7], count: 70, scale: [0.9, 1.1], seed: 4, y: 0.0 }),
  // coins resting on the mound: rings at rising heights
  ...[[0.78, 0.07, 18], [0.55, 0.16, 14], [0.32, 0.24, 9]].flatMap(([r, y, n]) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + r * 3
    return stamp("_coin", { pos: [Math.cos(a) * r, y, Math.sin(a) * r * 0.8], rot: [0, a * 57, 0] })
  })),
  stamp("_goblet", { pos: [0.15, 0.27, 0.05], rot: [0, 30, 6] }),
  stamp("_goblet", { pos: [-0.55, 0.1, 0.3], rot: [70, 0, 20] }),
  sphere(0.05, { mat: "gemB", pos: [0.4, 0.2, -0.2], detail: 1 }), sphere(0.04, { mat: "gem", pos: [-0.3, 0.22, -0.15], detail: 1 }),
  light({ color: "#ffcf80", power: 35, pos: [-0.2, 0.9, 0.6] }))                         // a warm glint on the gold

model("_chest", { pivot: "origin" },
  box(0.9, 0.5, 0.55, { mat: "wood" }),
  // the lid: a half barrel
  tf({ pos: [0, 0.5, 0], rot: [0, 0, 90] }, cyl(0.275, 0.9, { mat: "wood", sides: 12, pos: [0, -0.45, 0], scale: [1, 1, 1] })),
  // iron bands and a lock
  ...[-0.32, 0, 0.32].map((x) => [box(0.07, 0.52, 0.57, { mat: "ironFine", pos: [x, -0.005, 0] }),
    tf({ pos: [x, 0.5, 0], rot: [0, 0, 90] }, cyl(0.29, 0.07, { mat: "ironFine", sides: 12, pos: [0, -0.035, 0] }))]),
  box(0.12, 0.16, 0.04, { mat: "iron", pos: [0, 0.34, 0.29] }))

// ------------------------------------------------------------------ the door and torches

model("_door", { pivot: "origin" },
  box(0.12, 2.3, 1.4, { mat: "conc", pos: [0, 0, 0] }),            // frame
  box(0.1, 2.15, 1.2, { mat: "iron", pos: [0.05, 0, 0] }),         // the iron door
  ...[0.4, 1.1, 1.8].map((y) => box(0.03, 0.1, 1.22, { mat: "ironFine", pos: [0.11, y, 0] })),
  sphere(0.06, { mat: "ironFine", pos: [0.13, 1.05, 0.42], detail: 1 }))

model("_torch", { pivot: "origin" },
  box(0.1, 0.1, 0.06, { mat: "iron", pos: [0, -0.05, 0.03] }),                          // wall plate
  box(0.05, 0.05, 0.2, { mat: "iron", pos: [0, -0.02, 0.14] }),                         // bracket
  cyl(0.032, 0.42, { mat: "wood", sides: 6, pos: [0, -0.1, 0.2], rot: [20, 0, 0] }),     // the handle leans out from the wall
  cyl(0.045, 0.06, { mat: "soot", sides: 6, pos: [0, 0.28, 0.33], rot: [20, 0, 0] }),    // pitch-soaked head
  sphere(0.07, { mat: "flame", pos: [0, 0.4, 0.38], scale: [1, 1.9, 1], detail: 1 }),      // a teardrop flame
  light({ color: "#ffb060", power: 95, pos: [0, 0.5, 1.0] }))                           // well out in front, so the flame's own shadow stays small

// ------------------------------------------------------------------ the scene

model("dragon_hoard", { pivot: "origin" },
  stamp("_room"),
  stamp("_pedestal", { pos: [NICHE.x, 0, -S - 0.3 - NICHE.d / 2 + 0.05] }),
  stamp("_egg", { pos: [NICHE.x, 0.8, -S - 0.3 - NICHE.d / 2 + 0.05], rot: [0, 0, 6] }),
  stamp("_runes", { pos: [NICHE.x, 0, -S - 0.19 - NICHE.d] }),
  light({ color: "#5af0d0", power: 22, pos: [NICHE.x, 1.5, -S - 0.25] }),            // the egg's eerie glow, kept inside the niche
  light({ type: "spot", color: "#ffd0a0", power: 160, pos: [NICHE.x, 2.9, -S + 0.9], dir: [0, -0.8, -0.6], angle: 28 }),
  stamp("_lavapit", { pos: [PIT.x, 0, PIT.z] }),
  stamp("_hoard", { pos: [1.35, 0, -0.9] }),
  stamp("_chest", { pos: [0.6, 0, 1.0], rot: [0, -25, 0] }),
  stamp("_door", { pos: [-S + 0.05, 0, -0.9] }),
  stamp("_torch", { pos: [-S + 0.02, 1.75, 0.6], rot: [0, 90, 0] }),
  stamp("_torch", { pos: [-1.0, 1.75, -S + 0.02] }),
  scatter("_coin", { area: [0.4, -0.2, 2.2, 0.4], count: 26, scale: [0.9, 1.1], seed: 9 }))
