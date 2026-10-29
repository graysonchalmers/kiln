// Image -> blockout (2026-10-23): reference image -> image-decomp spec -> recipe picks -> this scene -> likeness + blind
// judge against the image. Refs: Quaternius Stylized Nature (CC0) crops in .proof/2026-10-23-img2blockout/refs.
include("../lib/grayson/nature.kx.js")
include("../lib/grayson/props.kx.js")
include("../lib/grayson/styles.kx.js")
style("cozy")
pal({ maple: "#d83a24", mapleL: "#f25a36", mapleD: "#a8241a", birch: "#cfc3b0" })

// v0: one-line recipes, no decomposition (the floor the loop has to beat)
model("broadleaf_v0", trunk(1.2, { r: 0.15 }), canopy(0.6, { at: [0, 1.5, 0] }))
model("pine_v0", conifer(2.2))
model("maple_v0", trunk(1.2, { r: 0.15 }), canopy(0.7, { at: [0, 1.6, 0], tones: ["maple", "mapleL", "mapleD"] }))

// ---------- v1: built from the image-decomp spec (fractions of height H, origin at the trunk base)
pal({ pin: "#699d4b", pinL: "#75b545", pinD: "#4c7634", pbark: "#685852", ptwig: "#8a6e64" })
// pine: ogive (widest at 0.40H, bottom skirt narrower and left), ~7 drooping saw-tooth tiers, axis leans right to +0.08H,
// blunt multi-tip crown, short flared trunk (0.18H visible), two bare twigs under the bottom skirt.
const PH = 2.2
const pine_v1 = () => [
  trunk(PH * 0.42, { r: PH * 0.03, flare: 1.7, taper: 0.6, mat: "pbark", lean: [PH * 0.02, 0] }),
  tube([-0.08 * PH, 0.2 * PH, 0, -0.14 * PH, 0.17 * PH, 0.02, -0.19 * PH, 0.13 * PH, 0.03], 0.014, { mat: "ptwig", top: 0.006 }),
  tube([0.04 * PH, 0.21 * PH, 0, 0.14 * PH, 0.2 * PH, -0.02, 0.23 * PH, 0.18 * PH, -0.03], 0.014, { mat: "ptwig", top: 0.006 }),
  [[0.24, 0.21, -0.04], [0.40, 0.31, 0.02], [0.54, 0.25, 0.03], [0.60, 0.23, 0.04], [0.66, 0.19, 0.045], [0.72, 0.18, 0.055], [0.78, 0.15, 0.065]]
    .map(([h, hw, x], i) => tf({ pos: [x * PH, h * PH, 0] },
      cone(hw * PH * 0.72, PH * 0.13, { mat: "pinD", sides: S(8), pos: [0, -PH * 0.07, 0], jitter: 0.02, seed: i }),
      fronds(8, { len: hw * PH, lift: 0.04, droop: 0.9, w0: hw * PH * 0.55, tip: 0.15, zig: 0.45, wild: 0.5, seed: 7 + i, tones: ["pin", "pinL"], thick: 0.03 }))),
  tf({ pos: [0.08 * PH, 0.86 * PH, 0] }, cone(0.11 * PH, 0.14 * PH, { mat: "pin", sides: S(6), jitter: 0.02 }),
    fronds(4, { len: 0.1 * PH, lift: 0.12, droop: 0.2, w0: 0.06 * PH, zig: 0.4, seed: 3, tones: ["pinL", "pin"], thick: 0.03 }))]
model("pine_v1", pine_v1())

// broadleaf: crown lopsided left (60% of foliage left of the axis), long bare bole (0.39H) tapering to 0.3x with a root
// flare, kinks left into the crown at 0.36-0.53H, two-tier outline (narrow cap on a wide middle at 0.69H), toothed lobes.
pal({ bl: "#9fc943", blL: "#aed34d", blD: "#63882e", blBark: "#8e6858", blBarkD: "#6d534a" })
const BH = 2.6, lobe = (x, y, rx, ry, seed, z = 0) => tf({ pos: [x * BH, y * BH, z * BH], scale: [1, ry / rx, 1] },
  canopy(rx * BH * 0.68, { seed, puffs: 6, wild: 0.8, tones: ["bl", "blL", "blD"] }))
model("broadleaf_v1",
  tube([0, 0, 0, 0, 0.085 * BH, 0, -0.01 * BH, 0.18 * BH, 0, -0.019 * BH, 0.36 * BH, 0, -0.04 * BH, 0.45 * BH, 0, -0.066 * BH, 0.56 * BH, 0],
    [0.07, 0.08, 0.06, 0.037, 0.025, 0.02].map(r => r * BH), { mat: "blBark", sides: S(7), jitter: 0.01 }),
  tube([0.02 * BH, 0.4 * BH, 0, 0.072 * BH, 0.47 * BH, 0], 0.016 * BH, { mat: "blBark", top: 0.008 * BH }),
  tube([-0.06 * BH, 0.39 * BH, 0, -0.13 * BH, 0.375 * BH, 0.02, -0.18 * BH, 0.37 * BH, 0.03, -0.19 * BH, 0.4 * BH, 0.03], 0.008 * BH, { mat: "blBarkD", top: 0.004 * BH }),
  lobe(0.003, 0.894, 0.186, 0.149, 1), lobe(-0.024, 0.67, 0.133, 0.133, 2, 0.05), lobe(-0.205, 0.691, 0.154, 0.16, 3),
  lobe(-0.157, 0.479, 0.117, 0.085, 4), lobe(0.12, 0.617, 0.133, 0.144, 5), lobe(-0.05, 0.7, 0.12, 0.12, 6, -0.12))

// maple: windswept teardrop crown, long axis 45 deg lower-left to upper-right, offset hard right (9% left of the base),
// 6 big lobes + stepped puffs on the left flank, short pale trunk (0.25H) leaning ~20 deg right with a root flare.
const MH = 3.0, mx = (x) => x * 0.81 * MH, mlobe = (x, y, d, seed, z = 0, sq = 1) => tf({ pos: [mx(x), y * MH, z * MH], scale: [1, sq, 1] },
  canopy(d / 2 * MH * 0.7, { seed, puffs: 5, wild: 0.7, tones: ["maple", "mapleL", "mapleD"] }))
pal({ maple: "#d03f37", mapleL: "#d85f53", mapleD: "#882e29", mBark: "#a59a89", mBarkD: "#635a52" })
model("maple_v1",
  tube([0, 0, 0, mx(0.03), 0.1 * MH, 0, mx(0.1), 0.25 * MH, 0, mx(0.32), 0.33 * MH, 0, mx(0.4), 0.47 * MH, 0],
    [0.08, 0.06, 0.043, 0.02, 0.017].map(r => r * MH), { mat: "mBark", sides: S(7), jitter: 0.01 }),
  [[0.4, 0.47, 0.5, 0.75], [0.4, 0.47, 0.6, 0.62], [0.13, 0.36, 0.06, 0.4]].map(([a, b, c, d]) =>
    tube([mx(a), b * MH, 0, mx(c), d * MH, 0], 0.012 * MH, { mat: "mBarkD", top: 0.006 * MH })),
  [[0.35, 0.86], [0.51, 0.89], [0.42, 0.75], [0.57, 0.75], [0.65, 0.7]].map(([x, y], i) =>
    tube([mx(x), (y - 0.12) * MH, 0.05, mx(x + 0.02 * (i % 2)), y * MH, 0.05], 0.008 * MH, { mat: "mBark", top: 0.004 * MH })),
  mlobe(0.46, 0.89, 0.3, 1, 0, 0.8), mlobe(0.72, 0.72, 0.22, 2), mlobe(0.70, 0.46, 0.13, 3), mlobe(0.40, 0.26, 0.19, 4),
  mlobe(0.04, 0.40, 0.37, 5, 0.03), mlobe(0.19, 0.72, 0.18, 6), mlobe(0.44, 0.57, 0.40, 7, -0.05),
  [[0.05, 0.6], [-0.03, 0.53], [-0.08, 0.47], [-0.12, 0.42]].map(([x, y], i) => mlobe(x, y, 0.08, 10 + i)))

// ---------- v2: the blind likeness judge's fixes on v1 (pine 7/10, broadleaf 5/10, maple 3/10)
// pine: boughs droop 20-30 deg and 20% shorter, tip sunk into the top tier, brighter yellow-green, bottom tier raised + narrower
pal({ pin2: "#7fb84a", pin2L: "#9ccf55", pin2D: "#5a8a3a" })
model("pine_v2",
  trunk(PH * 0.42, { r: PH * 0.03, flare: 1.7, taper: 0.6, mat: "pbark", lean: [PH * 0.02, 0] }),
  tube([-0.08 * PH, 0.22 * PH, 0, -0.12 * PH, 0.19 * PH, 0.02, -0.15 * PH, 0.15 * PH, 0.03], 0.012, { mat: "ptwig", top: 0.005 }),
  tube([0.04 * PH, 0.22 * PH, 0, 0.09 * PH, 0.19 * PH, -0.02, 0.13 * PH, 0.15 * PH, -0.03], 0.012, { mat: "ptwig", top: 0.005 }),
  [[0.29, 0.19, -0.04], [0.40, 0.31, 0.02], [0.52, 0.26, 0.03], [0.59, 0.23, 0.04], [0.66, 0.2, 0.045], [0.72, 0.17, 0.055], [0.78, 0.15, 0.065]]
    .map(([h, hw, x], i) => tf({ pos: [x * PH, h * PH, 0] },
      cone(hw * PH * 0.8, PH * 0.15, { mat: "pin2D", sides: S(8), pos: [0, -PH * 0.08, 0], jitter: 0.02, seed: i }),
      fronds(8, { len: hw * PH * 0.82, lift: 0.15, droop: 2.4, w0: hw * PH * 0.55, tip: 0.15, zig: 0.45, wild: 0.5, seed: 7 + i, tones: ["pin2", "pin2L"], thick: 0.03 }))),
  tf({ pos: [0.075 * PH, 0.78 * PH, 0] }, cone(0.15 * PH, 0.22 * PH, { mat: "pin2", sides: S(7), jitter: 0.02 }),
    fronds(5, { len: 0.12 * PH, lift: 0.1, droop: 2.0, w0: 0.07 * PH, zig: 0.4, seed: 3, tones: ["pin2L", "pin2"], thick: 0.03 })))

// broadleaf: one compact crown (lobes overlap, top cluster pulled down), thicker trunk with a base flare and bend,
// short left branch tucked in, no right stub
const blobe = (x, y, rx, ry, seed, z = 0) => tf({ pos: [x * BH, y * BH, z * BH], scale: [1, ry / rx, 1] },
  canopy(rx * BH * 0.95, { seed, puffs: 6, wild: 0.6, tones: ["bl", "blL", "blD"] }))
const broadleaf_v2 = () => [
  tube([0.012 * BH, 0, 0, 0.008 * BH, 0.085 * BH, 0, -0.005 * BH, 0.18 * BH, 0, -0.02 * BH, 0.36 * BH, 0, -0.045 * BH, 0.46 * BH, 0, -0.066 * BH, 0.58 * BH, 0],
    [0.1, 0.085, 0.07, 0.055, 0.047, 0.04].map(r => r * BH), { mat: "blBark", sides: S(7), jitter: 0.01 }),
  tube([-0.06 * BH, 0.42 * BH, 0, -0.1 * BH, 0.43 * BH, 0.02], 0.012 * BH, { mat: "blBarkD", top: 0.006 * BH }),
  blobe(-0.01, 0.82, 0.175, 0.15, 1), blobe(-0.03, 0.66, 0.15, 0.15, 2, 0.05), blobe(-0.19, 0.67, 0.15, 0.15, 3),
  blobe(-0.12, 0.52, 0.12, 0.09, 4), blobe(0.1, 0.6, 0.13, 0.13, 5), blobe(-0.06, 0.7, 0.14, 0.14, 6, -0.12)]
model("broadleaf_v2", broadleaf_v2())

// maple: one dense crown stretched along a 40 deg diagonal (lobes 1.6x, overlapping, upper-right end further out),
// trunk straight along the lean, branches fanned and buried, saturated red-orange, no pebble puffs
pal({ maple2: "#e8402a", maple2L: "#f86a3c", maple2D: "#b02a20" })
const m2lobe = (x, y, d, seed, z = 0, sq = 1) => tf({ pos: [mx(x), y * MH, z * MH], scale: [1, sq, 1] },
  canopy(d / 2 * MH * 0.75, { seed, puffs: 5, wild: 0.6, tones: ["maple2", "maple2L", "maple2D"] }))
model("maple_v2",
  tube([0, 0, 0, mx(0.04), 0.1 * MH, 0, mx(0.13), 0.25 * MH, 0, mx(0.27), 0.42 * MH, 0, mx(0.38), 0.55 * MH, 0],
    [0.095, 0.07, 0.05, 0.035, 0.025].map(r => r * MH), { mat: "mBark", sides: S(7), jitter: 0.01 }),
  [-25, 0, 25].map((a, i) => { const t = (40 + a) * Math.PI / 180, L = 0.32 - i * 0.03
    return tube([mx(0.38), 0.55 * MH, 0, mx(0.38) + Math.sin(t) * L * MH, (0.55 + Math.cos(t) * L) * MH, 0.04], 0.018 * MH, { mat: "mBarkD", top: 0.007 * MH }) }),
  m2lobe(0.6, 0.9, 0.46, 1, 0, 0.85), m2lobe(0.86, 0.76, 0.34, 2), m2lobe(0.74, 0.5, 0.24, 3), m2lobe(0.42, 0.3, 0.28, 4),
  m2lobe(0.1, 0.4, 0.5, 5, 0.03), m2lobe(0.26, 0.68, 0.3, 6), m2lobe(0.48, 0.6, 0.6, 7, -0.05))

// ---------- round 2 (2026-10-23)
// pine v3: v1 (kept) with boughs at a measured 20 deg tip angle (leaf angle option) instead of v2's guessed droop
model("pine_v3",
  trunk(PH * 0.42, { r: PH * 0.03, flare: 1.7, taper: 0.6, mat: "pbark", lean: [PH * 0.02, 0] }),
  tube([-0.08 * PH, 0.2 * PH, 0, -0.14 * PH, 0.17 * PH, 0.02, -0.19 * PH, 0.13 * PH, 0.03], 0.014, { mat: "ptwig", top: 0.006 }),
  tube([0.04 * PH, 0.21 * PH, 0, 0.14 * PH, 0.2 * PH, -0.02, 0.23 * PH, 0.18 * PH, -0.03], 0.014, { mat: "ptwig", top: 0.006 }),
  [[0.24, 0.21, -0.04], [0.40, 0.31, 0.02], [0.54, 0.25, 0.03], [0.60, 0.23, 0.04], [0.66, 0.19, 0.045], [0.72, 0.18, 0.055], [0.78, 0.15, 0.065]]
    .map(([h, hw, x], i) => tf({ pos: [x * PH, h * PH, 0] },
      cone(hw * PH * 0.72, PH * 0.13, { mat: "pinD", sides: S(8), pos: [0, -PH * 0.07, 0], jitter: 0.02, seed: i }),
      fronds(8, { len: hw * PH, lift: 0.04, angle: 20, w0: hw * PH * 0.55, tip: 0.15, zig: 0.45, wild: 0.5, seed: 7 + i, tones: ["pin", "pinL"], thick: 0.03 }))),
  tf({ pos: [0.08 * PH, 0.86 * PH, 0] }, cone(0.11 * PH, 0.14 * PH, { mat: "pin", sides: S(6), jitter: 0.02 }),
    fronds(4, { len: 0.1 * PH, lift: 0.12, angle: 15, w0: 0.06 * PH, zig: 0.4, seed: 3, tones: ["pinL", "pin"], thick: 0.03 })))

// maple v3: v2's dense crown (merged canopies) on v1's visible pale trunk, branches and 45 deg diagonal, v1's red
const m3lobe = (x, y, d, seed, z = 0, sq = 1) => tf({ pos: [mx(x), y * MH, z * MH], scale: [1, sq, 1] },
  canopy(d / 2 * MH * 0.85, { seed, puffs: 6, wild: 0.6, merge: 0.8, tones: ["maple", "mapleL", "mapleD"] }))
model("maple_v3",
  tube([0, 0, 0, mx(0.03), 0.1 * MH, 0, mx(0.1), 0.25 * MH, 0, mx(0.32), 0.33 * MH, 0, mx(0.4), 0.47 * MH, 0],
    [0.09, 0.065, 0.045, 0.022, 0.018].map(r => r * MH), { mat: "mBark", sides: S(7), jitter: 0.01 }),
  [[0.4, 0.47, 0.5, 0.75], [0.4, 0.47, 0.6, 0.62], [0.13, 0.36, 0.06, 0.4]].map(([a, b, c, d]) =>
    tube([mx(a), b * MH, 0, mx(c), d * MH, 0], 0.012 * MH, { mat: "mBarkD", top: 0.006 * MH })),
  m3lobe(0.52, 0.86, 0.36, 1, 0, 0.85), m3lobe(0.76, 0.72, 0.28, 2), m3lobe(0.70, 0.48, 0.18, 3), m3lobe(0.40, 0.3, 0.22, 4),
  m3lobe(0.04, 0.42, 0.36, 5, 0.03), m3lobe(0.21, 0.7, 0.24, 6), m3lobe(0.45, 0.58, 0.44, 7, -0.05))

// boulder (non-tree reference: Poly Haven boulder_01, CC0, transparent thumbnail)
model("boulder_v0", rock(0.6, { mat: "stone", seed: 3 }))
// boulder v1 from the decomposition's 6 fitted masses (their union scored IoU 0.966 on the reference mask): positions as
// (fx of W, fy of H), sizes in H, roll in degrees; W/H 1.35, narrow ground contact on the right, left nose lifted
pal({ bst: "#6a5440", bstL: "#86705c", bstD: "#4a3828" })
const BW = 1.35, mass = (fx, fy, w, h, roll, seed, d = 0.75, flat = 0) => tf({ pos: [fx * BW, fy, 0], rot: [0, 0, roll], scale: [w / h, 1, d / h] },
  rock(h / 2, { mat: "bst", squash: 1, rough: 0.18, seed, flat, cap: "bstL", capAngle: 35, detail: SD(1) }))
model("boulder_v1",
  mass(0, 0.62, 0.89, 0.58, 11, 1), mass(-0.31, 0.54, 0.46, 0.5, 21, 3, 0.6), mass(0.31, 0.55, 0.24, 0.28, -3, 4, 0.5),
  mass(0.25, 0.27, 0.65, 0.48, -18, 5, 0.7, 0.3), mass(-0.07, 0.28, 0.51, 0.28, -21, 6, 0.6),
  box(0.22, 0.14, 0.24, { mat: "bstL", pos: [0.06 * BW, 0.8, 0], rot: [0, 0, -9], bevel: 0.02 }))

// ---------- round 3 (2026-10-23)
// boulder v2: the same 6 masses joined by hull(): main body (M1 + cap + nose + belly) and the right shoulder + low slab as
// two hulls, so the crack/step between them stays concave; v1's separate rocks read as a pile.
const bm = (fx, fy, w, h, roll, d = 0.75) => tf({ pos: [fx * BW, fy, 0], rot: [0, 0, roll], scale: [w / h, 1, d / h] }, sphere(h / 2, { mat: "bst", detail: 1 }))
const boulder_v2 = (m = "bst", c = "bstL") => [
  hull({ mat: m, cap: c, capAngle: 35, jitter: 0.025, seed: 4 }, bm(0, 0.62, 0.89, 0.58, 11), bm(-0.31, 0.54, 0.46, 0.5, 21, 0.6), bm(-0.07, 0.28, 0.51, 0.28, -21, 0.6),
    box(0.22, 0.14, 0.24, { mat: m, pos: [0.06 * BW, 0.84, 0], rot: [0, 0, -9] })),
  hull({ mat: m, cap: c, capAngle: 35, jitter: 0.02, seed: 5 }, bm(0.31, 0.55, 0.24, 0.28, -3, 0.5), bm(0.25, 0.25, 0.65, 0.44, -18, 0.7))]
model("boulder_v2", boulder_v2())

// maple v4: a tall crown along a 45 deg diagonal (judge: ~0.85 w:h, v3 ~1.2), a hull core so no background shows between
// lobes, lumpy lobes on its surface for the clumpy edge, on v3's trunk
const M4 = [[-0.05, 0.42, 0.17], [0.1, 0.56, 0.21], [0.25, 0.7, 0.22], [0.4, 0.82, 0.2], [0.52, 0.94, 0.14], [0.55, 0.64, 0.15], [0.3, 0.36, 0.13]]
model("maple_v4",
  tube([0, 0, 0, mx(0.03), 0.1 * MH, 0, mx(0.1), 0.25 * MH, 0, mx(0.25), 0.36 * MH, 0, mx(0.35), 0.5 * MH, 0],
    [0.09, 0.065, 0.045, 0.024, 0.018].map(r => r * MH), { mat: "mBark", sides: S(7), jitter: 0.01 }),
  hull({ mat: "maple", jitter: 0.04, seed: 9 }, M4.map(([x, y, r]) => sphere(r * MH * 0.85, { mat: "maple", pos: [x * MH, y * MH, 0], detail: 1 }))),
  M4.map(([x, y, r], i) => canopy(r * MH * 0.75, { at: [x * MH, y * MH, (i % 2 ? 0.08 : -0.08) * MH], seed: 20 + i, puffs: 4, wild: 0.6, merge: 0.5, tones: ["maple", "mapleL", "mapleD"] })))

// barrel (hard-surface reference: Poly Haven wine_barrel_01, CC0, by James Ray Cock)
pal({ brl: "#7a5a3c", hoopM: { color: "#55575a", metal: 0.6, rough: 0.5 } })
model("barrel_v0", lathe([0.25, 0, 0.3, 0.45, 0.25, 0.9, 0, 0.9], { mat: "brl", sides: 16 }),
  [0.15, 0.75].map(y => torus(0.29, 0.015, { mat: "hoopM", rings: 16, sides: 4, pos: [0, y, 0] })))

// barrel v1 from the decomposition: symmetrised profile (r/H at h/H 0..1), 30 staves (lathe sides, flat-shaded facets),
// 6 iron hoops at measured heights (2 / 1 / gap / 1 / 2), head recessed 0.04H inside a 0.03H chime, 5 head boards,
// raised bung at 0.5H, azimuth +20 deg; palette sampled
pal({ brl1: "#6a5038", brlHead: "#806446", brlLip: "#977f66", brlBung: "#977656", hoop1: { color: "#59524c", metal: 0.6, rough: 0.5 } })
const BRH = 0.9, BRP = [0.348, 0.368, 0.388, 0.412, 0.423, 0.429, 0.423, 0.412, 0.388, 0.368, 0.348]
const brR = (h) => { const i = Math.min(9, Math.floor(h * 10)), t = h * 10 - i; return BRP[i] + (BRP[i + 1] - BRP[i]) * t }
const barrel_v1 = () => [
  lathe([0, 0, ...BRP.flatMap((r, i) => [r * BRH, i * 0.1 * BRH]), 0.318 * BRH, BRH, 0.318 * BRH, 0.96 * BRH, 0, 0.96 * BRH], { mat: "brl1", sides: 30 }),
  [[0.958, 0.055], [0.862, 0.033], [0.687, 0.049], [0.32, 0.046], [0.142, 0.032], [0.046, 0.054]].map(([c, w]) =>
    lathe([(brR(c - w / 2) + 0.008) * BRH, (c - w / 2) * BRH, (brR(c + w / 2) + 0.008) * BRH, (c + w / 2) * BRH], { mat: "hoop1", sides: 30 })),
  [-2, -1, 0, 1, 2].map(k => { const z = k * 0.126 * BRH, half = Math.sqrt(Math.max(0, (0.318 * BRH) ** 2 - z * z))
    return box(half * 2 * 0.98, 0.012, 0.12 * BRH, { mat: k % 2 ? "brlHead" : "brl1", pos: [0, 0.96 * BRH + 0.004, z] }) }),
  tf({ rot: [0, 20, 0] }, cyl(0.028 * BRH, 0.02 * BRH, { mat: "brlBung", sides: 10, rot: [90, 0, 0], pos: [0, 0.5 * BRH, 0.425 * BRH] }))]
model("barrel_v1", barrel_v1())

// ---------- round 4 (2026-10-23)
// barrel v2: v1 with hoops that read (judge: "thin dark bands that almost merge into the wood"): 35% wider, prouder,
// lighter metal
pal({ hoop2: { color: "#8a857e", metal: 0.55, rough: 0.45 } })
model("barrel_v2",
  lathe([0, 0, ...BRP.flatMap((r, i) => [r * BRH, i * 0.1 * BRH]), 0.318 * BRH, BRH, 0.318 * BRH, 0.96 * BRH, 0, 0.96 * BRH], { mat: "brl1", sides: 30 }),
  [[0.958, 0.055], [0.862, 0.033], [0.687, 0.049], [0.32, 0.046], [0.142, 0.032], [0.046, 0.054]].map(([c, w0]) => { const w = w0 * 1.35
    return lathe([(brR(c - w / 2) + 0.014) * BRH, (c - w / 2) * BRH, (brR(c + w / 2) + 0.014) * BRH, (c + w / 2) * BRH], { mat: "hoop2", sides: 30 }) }),
  [-2, -1, 0, 1, 2].map(k => { const z = k * 0.126 * BRH, half = Math.sqrt(Math.max(0, (0.318 * BRH) ** 2 - z * z))
    return box(half * 2 * 0.98, 0.012, 0.12 * BRH, { mat: k % 2 ? "brlHead" : "brl1", pos: [0, 0.96 * BRH + 0.004, z] }) }),
  tf({ rot: [0, 20, 0] }, cyl(0.028 * BRH, 0.02 * BRH, { mat: "brlBung", sides: 10, rot: [90, 0, 0], pos: [0, 0.5 * BRH, 0.425 * BRH] })))

// boulder v3: a broad lumpy plateau at the top centre (judge: "peak too far left and too pointed"), the right slab longer
// and lower, rougher facets, a dark crack in the seam between the two hulls instead of a clean join
model("boulder_v3",
  hull({ mat: "bst", cap: "bstL", capAngle: 35, jitter: 0.04, seed: 4 }, bm(0, 0.62, 0.89, 0.58, 6), bm(-0.31, 0.54, 0.46, 0.5, 21, 0.6), bm(-0.07, 0.28, 0.51, 0.28, -21, 0.6),
    bm(0.04, 0.9, 0.46, 0.16, 0, 0.55)),
  hull({ mat: "bst", cap: "bstL", capAngle: 35, jitter: 0.035, seed: 5 }, bm(0.33, 0.52, 0.24, 0.28, -3, 0.5), bm(0.3, 0.22, 0.75, 0.42, -18, 0.7)),
  tf({ pos: [0.19 * BW, 0.44, 0.02], rot: [0, 0, 18] }, box(0.5, 0.035, 0.62, { mat: "bstD" })))

// maple v5: v3's clumpy merged lobes (no hull core) laid out along v4's tall 45 deg diagonal, brighter scarlet (judge: v3
// "too dark, maroon")
pal({ mapleS: "#e5352b", mapleSL: "#f45a46", mapleSD: "#b32a22" })
const maple_v5 = () => [
  tube([0, 0, 0, mx(0.03), 0.1 * MH, 0, mx(0.1), 0.25 * MH, 0, mx(0.25), 0.36 * MH, 0, mx(0.35), 0.5 * MH, 0],
    [0.09, 0.065, 0.045, 0.024, 0.018].map(r => r * MH), { mat: "mBark", sides: S(7), jitter: 0.01 }),
  [[0.35, 0.5, 0.6, 0.72], [0.35, 0.5, 0.45, 0.85], [0.25, 0.36, 0.08, 0.5]].map(([a, b, c, d]) =>
    tube([a * MH, b * MH, 0, c * MH, d * MH, 0], 0.012 * MH, { mat: "mBarkD", top: 0.006 * MH })),
  M4.map(([x, y, r], i) => canopy(r * MH * 1.0, { at: [x * MH, y * MH, (i % 2 ? 0.05 : -0.05) * MH], seed: 30 + i, puffs: 6, wild: 0.6, merge: 0.8, tones: ["mapleS", "mapleSL", "mapleSD"] }))]
model("maple_v5", maple_v5())

// crate (box-built hard surface: Poly Haven old_military_crate, CC0, by Jack Mava; the closed one of the thumbnail's two)
pal({ crateG: "#5f6440" })
model("crate_v0", box(0.9, 0.36, 0.45, { mat: "crateG" }), box(0.92, 0.06, 0.47, { mat: "crateG", pos: [0, 0.36, 0] }))

// crate v1 from the image-measured spec only (the decomposition agent also fetched the source mesh; those values were
// not used, so the loop stays image -> blockout): front ~2.7:1, lid slab with a seam 0.16H down, two battens over two
// skids at 19% / 81% of the length, two draw latches at 25% / 75%, corner posts, three boards per face, grey canvas flap
// over the left end. Depth (0.56L) is an assumption: one view cannot pin it.
pal({ crW: "#635d44", crW2: "#5b543e", crLid: "#716e55", crLid2: "#6a6650", crDark: "#272519", crHw: "#58593d", canvas: "#64645d" })
const CL = 0.77, CH = CL / 2.7, CD = CL * 0.56, cu = (u) => (u - 0.5) * CL
model("crate_v1",
  [0.19, 0.81].map(u => box(0.083 * CL, 0.104 * CH, CD, { mat: "crDark", pos: [cu(u), 0, 0] })),
  planks(CL, 0.817 * CH, CD, { along: "x", across: "y", n: 3, gap: 0.004, tones: ["crW", "crW2"], at: [0, 0.052 * CH, 0], seed: 2 }),
  planks(CL, 0.156 * CH, CD + 0.041 * CL, { along: "x", across: "z", n: 3, gap: 0.004, tones: ["crLid", "crLid2"], at: [0, 0.844 * CH, 0.0025 * CL], seed: 3 }),
  [0.19, 0.81].map(u => box(0.083 * CL, 0.042 * CH, CD, { mat: "crLid", pos: [cu(u), CH, 0] })),
  sym("x", sym("z", box(0.07 * CL, 0.567 * CH, 0.07 * CL, { mat: "crHw", pos: [CL / 2 - 0.03 * CL, 0.215 * CH, CD / 2 - 0.03 * CL] }))),
  [0.256, 0.744].map(u => [box(0.052 * CL, 0.384 * CH, 0.03 * CL, { mat: "crHw", pos: [cu(u), 0.433 * CH, CD / 2] }),
    box(0.079 * CL, 0.218 * CH, 0.012 * CL, { mat: "crDark", pos: [cu(u), 0.713 * CH, CD / 2 + 0.023 * CL] })]),
  box(0.02, 0.69 * CH, CD + 0.06 * CL, { mat: "canvas", pos: [-CL / 2 - 0.012, 0.16 * CH, 0] }),
  extrude([0, 0.844 * CH, 0.14 * CL, 0.844 * CH, 0, 0.6 * CH], 0.012, { mat: "canvas", pos: [-CL / 2, 0, CD / 2 + 0.001] }))

// ---------- round 5 (2026-10-23)
// barrel v3: values matched to the reference by measurement (hoopv: hoop pixels median V vs wood): reference hoop 30 /
// wood 35 (iron a little darker than wood, set apart by being grey); v1 rendered 24 / 25 (merged), v2 34 / 25 (silver).
pal({ brl3: "#8f6c4c", brl3Head: "#a07e58", hoop3: { color: "#7a726a", metal: 0.6, rough: 0.5 } })
model("barrel_v3",
  lathe([0, 0, ...BRP.flatMap((r, i) => [r * BRH, i * 0.1 * BRH]), 0.318 * BRH, BRH, 0.318 * BRH, 0.96 * BRH, 0, 0.96 * BRH], { mat: "brl3", sides: 30 }),
  [[0.958, 0.055], [0.862, 0.033], [0.687, 0.049], [0.32, 0.046], [0.142, 0.032], [0.046, 0.054]].map(([c, w0]) => { const w = w0 * 1.2
    return lathe([(brR(c - w / 2) + 0.01) * BRH, (c - w / 2) * BRH, (brR(c + w / 2) + 0.01) * BRH, (c + w / 2) * BRH], { mat: "hoop3", sides: 30 }) }),
  [-2, -1, 0, 1, 2].map(k => { const z = k * 0.126 * BRH, half = Math.sqrt(Math.max(0, (0.318 * BRH) ** 2 - z * z))
    return box(half * 2 * 0.98, 0.012, 0.12 * BRH, { mat: k % 2 ? "brl3Head" : "brl3", pos: [0, 0.96 * BRH + 0.004, z] }) }),
  tf({ rot: [0, 20, 0] }, cyl(0.028 * BRH, 0.02 * BRH, { mat: "brlBung", sides: 10, rot: [90, 0, 0], pos: [0, 0.5 * BRH, 0.425 * BRH] })))

// boulder v4: one connected mass (judge: v2 "two stones leaning together"): a single hull over v2's six masses, the crack
// CUT into the front face with subtract() along the measured line (fx -0.01, fy 0.35 -> fx +0.39, fy 0.52, rising 18 deg)
// instead of v3's added box (read as a stick); the carved walls are the dark crack material
model("boulder_v4",
  subtract(
    hull({ mat: "bst", cap: "bstL", capAngle: 35, jitter: 0.03, seed: 4 }, bm(0, 0.62, 0.89, 0.58, 11), bm(-0.31, 0.54, 0.46, 0.5, 21, 0.6),
      bm(-0.07, 0.28, 0.51, 0.28, -21, 0.6), box(0.22, 0.14, 0.24, { mat: "bst", pos: [0.06 * BW, 0.82, 0], rot: [0, 0, -9] }),
      bm(0.31, 0.55, 0.24, 0.28, -3, 0.5), bm(0.25, 0.25, 0.65, 0.44, -18, 0.7)),
    tf({ pos: [0.19 * BW, 0.41, 0.28], rot: [0, 0, 18] }, box(0.62, 0.06, 0.5, { mat: "bstD" }))))

// crate v2: v1 + hasp straps (judge: latches were "plain dark squares, without the strap hasps running down the front").
// Colour: measured, the v1 render was DARKER than the reference (median V 26 vs 40, S 33 vs 29, hue 52 vs 50), so the
// judge's "too light, yellow-khaki" read was the dark backdrop; v2 matches the measured medians, v2s uses the sampled
// shadow tones as asked. Both go to the blind A/B.
pal({ cr2W: "#9c9470", cr2W2: "#8f8865", cr2L: "#a8a27d", cr2L2: "#9e9873",
  cr2sW: "#524d39", cr2sW2: "#4a4533", cr2sL: "#625f48", cr2sL2: "#5a5742" })
const crate_v2 = () => [
  [0.19, 0.81].map(u => box(0.083 * CL, 0.104 * CH, CD, { mat: "crDark", pos: [cu(u), 0, 0] })),
  planks(CL, 0.817 * CH, CD, { along: "x", across: "y", n: 3, gap: 0.004, tones: ["cr2W", "cr2W2"], at: [0, 0.052 * CH, 0], seed: 2 }),
  planks(CL, 0.156 * CH, CD + 0.041 * CL, { along: "x", across: "z", n: 3, gap: 0.004, tones: ["cr2L", "cr2L2"], at: [0, 0.844 * CH, 0.0025 * CL], seed: 3 }),
  [0.19, 0.81].map(u => box(0.083 * CL, 0.042 * CH, CD, { mat: "cr2L", pos: [cu(u), CH, 0] })),
  sym("x", sym("z", box(0.07 * CL, 0.567 * CH, 0.07 * CL, { mat: "crHw", pos: [CL / 2 - 0.03 * CL, 0.215 * CH, CD / 2 - 0.03 * CL] }))),
  // hasp straps: a metal strap from the lid edge down the front face to the draw latch, a staple loop over the lid seam
  [0.256, 0.744].map(u => [box(0.03 * CL, 0.56 * CH, 0.008 * CL, { mat: "crHw", pos: [cu(u), 0.44 * CH, CD / 2 + 0.024 * CL] }),
    box(0.06 * CL, 0.16 * CH, 0.03 * CL, { mat: "crHw", pos: [cu(u), 0.43 * CH, CD / 2] }),
    box(0.075 * CL, 0.05 * CH, 0.014 * CL, { mat: "crDark", pos: [cu(u), 0.82 * CH, CD / 2 + 0.028 * CL] })]),
  box(0.02, 0.69 * CH, CD + 0.06 * CL, { mat: "canvas", pos: [-CL / 2 - 0.012, 0.16 * CH, 0] }),
  extrude([0, 0.844 * CH, 0.14 * CL, 0.844 * CH, 0, 0.6 * CH], 0.012, { mat: "canvas", pos: [-CL / 2, 0, CD / 2 + 0.001] })]
model("crate_v2", crate_v2())
model("crate_v2s",
  [0.19, 0.81].map(u => box(0.083 * CL, 0.104 * CH, CD, { mat: "crDark", pos: [cu(u), 0, 0] })),
  planks(CL, 0.817 * CH, CD, { along: "x", across: "y", n: 3, gap: 0.004, tones: ["cr2sW", "cr2sW2"], at: [0, 0.052 * CH, 0], seed: 2 }),
  planks(CL, 0.156 * CH, CD + 0.041 * CL, { along: "x", across: "z", n: 3, gap: 0.004, tones: ["cr2sL", "cr2sL2"], at: [0, 0.844 * CH, 0.0025 * CL], seed: 3 }),
  [0.19, 0.81].map(u => box(0.083 * CL, 0.042 * CH, CD, { mat: "cr2sL", pos: [cu(u), CH, 0] })),
  sym("x", sym("z", box(0.07 * CL, 0.567 * CH, 0.07 * CL, { mat: "crHw", pos: [CL / 2 - 0.03 * CL, 0.215 * CH, CD / 2 - 0.03 * CL] }))),
  // hasp straps: a metal strap from the lid edge down the front face to the draw latch, a staple loop over the lid seam
  [0.256, 0.744].map(u => [box(0.03 * CL, 0.56 * CH, 0.008 * CL, { mat: "crHw", pos: [cu(u), 0.44 * CH, CD / 2 + 0.024 * CL] }),
    box(0.06 * CL, 0.16 * CH, 0.03 * CL, { mat: "crHw", pos: [cu(u), 0.43 * CH, CD / 2] }),
    box(0.075 * CL, 0.05 * CH, 0.014 * CL, { mat: "crDark", pos: [cu(u), 0.82 * CH, CD / 2 + 0.028 * CL] })]),
  box(0.02, 0.69 * CH, CD + 0.06 * CL, { mat: "canvas", pos: [-CL / 2 - 0.012, 0.16 * CH, 0] }),
  extrude([0, 0.844 * CH, 0.14 * CL, 0.844 * CH, 0, 0.6 * CH], 0.012, { mat: "canvas", pos: [-CL / 2, 0, CD / 2 + 0.001] }))

// crate v3 (after the round-5 judge): v2's hasp straps (won 7-6 on them) in dark metal, with v1's olive (the judge found it
// closer than v2's median-matched khaki); not part of the main A/B, judged on its own against v2
model("crate_v3",
  [0.19, 0.81].map(u => box(0.083 * CL, 0.104 * CH, CD, { mat: "crDark", pos: [cu(u), 0, 0] })),
  planks(CL, 0.817 * CH, CD, { along: "x", across: "y", n: 3, gap: 0.004, tones: ["crW", "crW2"], at: [0, 0.052 * CH, 0], seed: 2 }),
  planks(CL, 0.156 * CH, CD + 0.041 * CL, { along: "x", across: "z", n: 3, gap: 0.004, tones: ["crLid", "crLid2"], at: [0, 0.844 * CH, 0.0025 * CL], seed: 3 }),
  [0.19, 0.81].map(u => box(0.083 * CL, 0.042 * CH, CD, { mat: "crLid", pos: [cu(u), CH, 0] })),
  sym("x", sym("z", box(0.07 * CL, 0.567 * CH, 0.07 * CL, { mat: "crHw", pos: [CL / 2 - 0.03 * CL, 0.215 * CH, CD / 2 - 0.03 * CL] }))),
  // hasp straps: a metal strap from the lid edge down the front face to the draw latch, a staple loop over the lid seam
  [0.256, 0.744].map(u => [box(0.03 * CL, 0.56 * CH, 0.008 * CL, { mat: "crDark", pos: [cu(u), 0.44 * CH, CD / 2 + 0.024 * CL] }),
    box(0.06 * CL, 0.16 * CH, 0.03 * CL, { mat: "crDark", pos: [cu(u), 0.43 * CH, CD / 2] }),
    box(0.075 * CL, 0.05 * CH, 0.014 * CL, { mat: "crDark", pos: [cu(u), 0.82 * CH, CD / 2 + 0.028 * CL] })]),
  box(0.02, 0.69 * CH, CD + 0.06 * CL, { mat: "canvas", pos: [-CL / 2 - 0.012, 0.16 * CH, 0] }),
  extrude([0, 0.844 * CH, 0.14 * CL, 0.844 * CH, 0, 0.6 * CH], 0.012, { mat: "canvas", pos: [-CL / 2, 0, CD / 2 + 0.001] }))

// ---------- round 6 (2026-10-23): colours matched on the reference's backdrop (shot.ts --bg), hue, saturation and value
// together per material class (hsvcls: warm wood / grey metal medians, reference vs render)
pal({ brl4: "#947054", brl4Head: "#b38b68", hoop4: { color: "#736d66", metal: 0.6, rough: 0.5 },
  cr4W: "#958b6b", cr4W2: "#888060", cr4L: "#a09877", cr4L2: "#968f6e", cr4Hw: "#8d9163", canvas4: "#9c9c92" })
model("barrel_v4",
  lathe([0, 0, ...BRP.flatMap((r, i) => [r * BRH, i * 0.1 * BRH]), 0.318 * BRH, BRH, 0.318 * BRH, 0.96 * BRH, 0, 0.96 * BRH], { mat: "brl4", sides: 30 }),
  [[0.958, 0.055], [0.862, 0.033], [0.687, 0.049], [0.32, 0.046], [0.142, 0.032], [0.046, 0.054]].map(([c, w]) =>
    lathe([(brR(c - w / 2) + 0.008) * BRH, (c - w / 2) * BRH, (brR(c + w / 2) + 0.008) * BRH, (c + w / 2) * BRH], { mat: "hoop4", sides: 30 })),
  [-2, -1, 0, 1, 2].map(k => { const z = k * 0.126 * BRH, half = Math.sqrt(Math.max(0, (0.318 * BRH) ** 2 - z * z))
    return box(half * 2 * 0.98, 0.012, 0.12 * BRH, { mat: k % 2 ? "brl4Head" : "brl4", pos: [0, 0.96 * BRH + 0.004, z] }) }),
  tf({ rot: [0, 20, 0] }, cyl(0.028 * BRH, 0.02 * BRH, { mat: "brlBung", sides: 10, rot: [90, 0, 0], pos: [0, 0.5 * BRH, 0.425 * BRH] })))
model("crate_v4",
  [0.19, 0.81].map(u => box(0.083 * CL, 0.104 * CH, CD, { mat: "crDark", pos: [cu(u), 0, 0] })),
  planks(CL, 0.817 * CH, CD, { along: "x", across: "y", n: 3, gap: 0.004, tones: ["cr4W", "cr4W2"], at: [0, 0.052 * CH, 0], seed: 2 }),
  planks(CL, 0.156 * CH, CD + 0.041 * CL, { along: "x", across: "z", n: 3, gap: 0.004, tones: ["cr4L", "cr4L2"], at: [0, 0.844 * CH, 0.0025 * CL], seed: 3 }),
  [0.19, 0.81].map(u => box(0.083 * CL, 0.042 * CH, CD, { mat: "cr4L", pos: [cu(u), CH, 0] })),
  sym("x", sym("z", box(0.07 * CL, 0.567 * CH, 0.07 * CL, { mat: "cr4Hw", pos: [CL / 2 - 0.03 * CL, 0.215 * CH, CD / 2 - 0.03 * CL] }))),
  // hasp straps: a metal strap from the lid edge down the front face to the draw latch, a staple loop over the lid seam
  [0.256, 0.744].map(u => [box(0.03 * CL, 0.56 * CH, 0.008 * CL, { mat: "cr4Hw", pos: [cu(u), 0.44 * CH, CD / 2 + 0.024 * CL] }),
    box(0.06 * CL, 0.16 * CH, 0.03 * CL, { mat: "cr4Hw", pos: [cu(u), 0.43 * CH, CD / 2] }),
    box(0.075 * CL, 0.05 * CH, 0.014 * CL, { mat: "crDark", pos: [cu(u), 0.82 * CH, CD / 2 + 0.028 * CL] })]),
  box(0.02, 0.69 * CH, CD + 0.06 * CL, { mat: "canvas4", pos: [-CL / 2 - 0.012, 0.16 * CH, 0] }),
  extrude([0, 0.844 * CH, 0.14 * CL, 0.844 * CH, 0, 0.6 * CH], 0.012, { mat: "canvas4", pos: [-CL / 2, 0, CD / 2 + 0.001] }))

// boulder v5: v2's two hulls (kept twice over the fused versions) with a crack cut deep and wide into the main body along
// the measured line (v4's 0.035 slit read as a faint crease)
model("boulder_v5",
  subtract(hull({ mat: "bst", cap: "bstL", capAngle: 35, jitter: 0.025, seed: 4 }, bm(0, 0.62, 0.89, 0.58, 11), bm(-0.31, 0.54, 0.46, 0.5, 21, 0.6), bm(-0.07, 0.28, 0.51, 0.28, -21, 0.6),
    box(0.22, 0.14, 0.24, { mat: "bst", pos: [0.06 * BW, 0.84, 0], rot: [0, 0, -9] })),
    tf({ pos: [0.17 * BW, 0.38, 0.32], rot: [0, 0, 18] }, box(0.7, 0.1, 0.6, { mat: "bstD" }))),
  hull({ mat: "bst", cap: "bstL", capAngle: 35, jitter: 0.02, seed: 5 }, bm(0.31, 0.55, 0.24, 0.28, -3, 0.5), bm(0.25, 0.25, 0.65, 0.44, -18, 0.7)))

// Kept after the blind A/B against each reference. Round 1: broadleaf v2 (7-4), pine v1 (6-4). Round 2: maple v3, pine tie.
// Round 3: boulder v2 (hull, 6-5), barrel v1 (8-4). Round 4: crate v1 (7-3), maple v5 (5-4); barrel v2, boulder v3 lost.
// Round 5: crate v2 over v1 (7-6, hasp straps) and over v3 (6-5); boulder v4 (one hull + subtract() crack) lost 5-6,
// barrel v3 (values matched by measurement, wood went orange) lost 7-8, crate v2s (shadow tones) tied v1.
// ---------- loom textures (2026-10-25): textured twins (`<name>_t`), same geometry. Blind A/B
// vs the flat builds: barrel and crate won (kept); boulder lost (crack decal read as blotches), trees tied (kept flat). Each key gets a
// near-white loom detail map (lib/grayson/materials) tinted by its measured hex, lifted by the map's mean so the
// average colour holds (kiln multiplies albedo by color).
const MATS = "../lib/grayson/materials/out/", MEAN = { woodgrain: 0.884, woodgrain_v: 0.884, painted: 0.868, metal: 0.867, canvas: 0.916, stone_broad: 0.871 }
const lift = (hex, m) => "#" + [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255, l = (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) / MEAN[m] ** 2.2,
  o = Math.min(1, l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055); return Math.round(o * 255).toString(16).padStart(2, "0") }).join("")
const T = (m, hex, uv, o = {}) => ({ tex: MATS + m, color: lift(hex, m), uv, ...o })
pal({ brl1: T("woodgrain_v", "#6a5038", 0.9), brlHead: T("woodgrain", "#806446", 0.9), brlBung: T("woodgrain", "#977656", 0.5), hoop1: T("metal", "#59524c", 0.5, { metal: 0.6, rough: 0.5 }),
  cr2W: T("painted", "#9c9470", 0.8), cr2W2: T("painted", "#8f8865", 0.8), cr2L: T("painted", "#a8a27d", 0.8), cr2L2: T("painted", "#9e9873", 0.8),
  crDark: T("woodgrain", "#272519", 0.6), crHw: T("metal", "#58593d", 0.4), canvas: T("canvas", "#64645d", 0.4) })
for (const [n, f] of Object.entries({ barrel_v1, crate_v2 })) model(n + "_t", f())
// boulder_v2_t (soft stone, no crack decal): broad low-contrast value variation; beat flat 6-5 (2026-10-25 retry)
pal({ bstT: T("stone_broad", "#6a5440", 0.7), bstLT: T("stone_broad", "#86705c", 0.7) })
model("boulder_v2_t", boulder_v2("bstT", "bstLT"))

// ---------- round 7 (2026-10-25): base tints scaled so the render's median value meets the reference's 40th value
// percentile on its object pixels (k = ref V p40 / render V median, --bg #e6e6e6 shots). Texture kept. Barrel won 6.5-6;
// barrel p30 tied, crate and boulder p30 lost and p40 tied (their gap is hue: crate too yellow, boulder lacks rust/grey).
const sc = (hex, k) => "#" + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, "0")).join("")
pal({ brl1: T("woodgrain_v", sc("#6a5038", 1.322), 0.9), brlHead: T("woodgrain", sc("#806446", 1.322), 0.9), brlBung: T("woodgrain", sc("#977656", 1.322), 0.5),
  hoop1: T("metal", sc("#59524c", 1.322), 0.5, { metal: 0.6, rough: 0.5 }) })
model("barrel_r7", barrel_v1())

// ---------- round 8 (2026-10-25): boulder craggy crown (form), crate olive hue from the reference's dark band
// boulder r8a: v2_t's two hulls with the crown cut into flat tilted facets by subtract() slabs (a cut crown, not a dome).
// A cutter is a box whose base plane passes through (fx, y, z), tilted rz/rx.
const slab = (fx, y, z, w, rz, rx = 0) => tf({ pos: [fx * BW, y, z], rot: [rx, 0, rz] }, box(w, 0.6, 1.4, { mat: "bstT" }))
// wide overlapping planes only: narrow cutters left fins between them, contained notches left a castle-like stub
// (a flat top plane too made v3's losing plateau, so the peak stays)
const crown = [slab(-0.62, 0.52, 0, 1.0, 36), slab(0.5, 0.66, 0, 1.0, -40), slab(0.32, 0.5, 0, 0.6, -24)]
const boulder_r8a = () => [subtract(boulder_v2("bstT", "bstLT")[0], ...crown.slice(0, 2)), subtract(boulder_v2("bstT", "bstLT")[1], crown[2])]
model("boulder_r8a", boulder_r8a())
// boulder r8b: v2_t + an embedded cluster of angular chunks (jittered rotated boxes) on the crown: blocky fractured masses
// with shadowed seams between them, like the reference's top; small horn crags read as ears and were dropped
const chunk = (fx, y, z, w, h, d, rx, ry, rz, seed, m = "bstT", c = "bstLT") => hull({ mat: m, cap: c, capAngle: 30, jitter: 0.02, seed },
  box(w, h, d, { mat: m, pos: [fx * BW, y, z], rot: [rx, ry, rz] }))
const CHUNKS = [[-0.2, 0.6, 0.08, 0.32, 0.26, 0.4, 12, 20, 24, 1], [0.05, 0.66, 0.02, 0.3, 0.26, 0.42, -10, -25, -12, 2],
  [-0.4, 0.46, 0.12, 0.24, 0.22, 0.34, 20, 35, 30, 3], [0.22, 0.56, 0.12, 0.22, 0.2, 0.3, -18, 10, -28, 4], [-0.05, 0.42, 0.26, 0.26, 0.2, 0.2, 30, -15, 8, 5]]
const boulder_r8b = (mats = []) => [boulder_v2(...(mats[5] ?? ["bstT", "bstLT"])), CHUNKS.map((a, i) => chunk(...a, ...(mats[i] ?? [])))]
model("boulder_r8b", boulder_r8b())

// r8 blind A/B vs kept: boulder r8a 4.5-4, r8b 6-4; crate r8a 6.5-5, r8b 6.5-6. Head-to-head: boulder r8b 6-4.5, crate r8a 6.5-5.5 (r8b "too yellow-green"). Kept: boulder_r8b, crate_r8a.
// crate r8a/r8b: wood tints from the reference's dark band (p0-40 of its object pixels: H51 S30 V35) instead of the median;
// walls x0.75, lid x0.65 (lit from above, it rendered V62 vs the reference's 44). r8b nudges hue greener (H58 S34).
pal({ cr2W: T("painted", "#757052", 0.8), cr2W2: T("painted", "#6b664b", 0.8), cr2L: T("painted", "#6d684c", 0.8), cr2L2: T("painted", "#676248", 0.8) })
model("crate_r8a", crate_v2())
pal({ cr2W: T("painted", "#75744d", 0.8), cr2W2: T("painted", "#6b6a47", 0.8), cr2L: T("painted", "#6d6c48", 0.8), cr2L2: T("painted", "#676644", 0.8) })
model("crate_r8b", crate_v2())

// ---------- round 9 (2026-10-25): boulder rust/grey patches per mass (judges' remaining gap), crate stencil marks
// r9 blind A/B vs kept: boulder r9a 6-5.5 + tiebreak 6-5, r9b lost 5-5.5 (grey chunks "boxes stuck on"); crate r9a 6.5-5.5, r9b 6.5-5.5,
// head-to-head r9b 6.5-6. Kept: boulder_r9a, crate_r9b.
// boulder r9a: r8b with chunks alternating rust and grey; r9b: rust body, grey chunks (the reference's grey sits in the fractures)
pal({ bstR: T("stone_broad", "#6c4a35", 0.7), bstRL: T("stone_broad", "#85614a", 0.7), bstG: T("stone_broad", "#5c5852", 0.7), bstGL: T("stone_broad", "#726d65", 0.7) })
const R = ["bstR", "bstRL"], G = ["bstG", "bstGL"]
model("boulder_r9a", boulder_r8b([R, G, R, G, R]))
model("boulder_r9b", boulder_r8b([G, G, G, G, G, R]))
// crate r9a: crate_r8a + the stenciled warning triangle on the front (outline = triangle minus inner triangle), raised 3 mm
// so it doesn't z-fight; r9b adds the lid's stencil text line as broken dark bars. Flat paint, no texture.
pal({ stencil: "#2b2a20" })
const tri = (s) => [-s / 2, 0, s / 2, 0, 0, s * 0.87]
const stencilTri = () => tf({ pos: [cu(0.57), 0.3 * CH, CD / 2] }, subtract(extrude(tri(0.13), 0.003, { mat: "stencil" }),
  extrude(tri(0.09), 0.01, { mat: "stencil", pos: [0, 0.012, -0.003] })))
const lidText = () => [0.3, 0.37, 0.45, 0.52, 0.6, 0.67].map((u, i) => box(0.05 * CL, 0.003, 0.025, { mat: "stencil", pos: [cu(u), CH, CD * 0.18] }))
pal({ cr2W: T("painted", "#757052", 0.8), cr2W2: T("painted", "#6b664b", 0.8), cr2L: T("painted", "#6d684c", 0.8), cr2L2: T("painted", "#676248", 0.8) })
model("crate_r9a", crate_v2(), stencilTri())
model("crate_r9b", crate_v2(), stencilTri(), lidText())

// ---------- round 10 (2026-10-25): mottled stone (colour varies inside a face, not one tint per face), lower crate
// r10 blind A/B vs kept: boulder r10a 6-5.5, r10b 6.5-5, h2h r10a 6-5.5 (broad grey/rust areas beat fine pink speckle). Crate r10a 6.5-6,
// r10b 6.5-6, h2h r10a 6.5-6, tiebreak r10a vs r9b 6-6 (tie): split judges keep the champion. Kept: boulder_r10a, crate_r9b.
// boulder r10a/r10b: boulder_r9a's form, every mass on one loom material with rust/tan/grey blotches baked in (tinted white; the first, darker and more saturated palette read as rusted metal, measured S61 vs the ref S40);
// r10a broad blotches, r10b finer ones
pal({ bstM: { tex: MATS + "stone_mottle", color: "#ffffff", uv: 0.7 }, bstMF: { tex: MATS + "stone_mottle_f", color: "#ffffff", uv: 0.7 } })
const M = ["bstM", "bstM"], MF = ["bstMF", "bstMF"]
model("boulder_r10a", boulder_r8b([M, M, M, M, M, M]))
model("boulder_r10b", boulder_r8b([MF, MF, MF, MF, MF, MF]))
// crate r10a/r10b: crate_r9b squashed in height (judge: "taller than the reference, which looks longer and lower"), x0.88 / x0.8
const crate_r9b = () => [crate_v2(), stencilTri(), lidText()]
model("crate_r10a", tf({ scale: [1, 0.88, 1] }, crate_r9b()))
model("crate_r10b", tf({ scale: [1, 0.8, 1] }, crate_r9b()))

// ---------- round 11 (2026-10-25): boulder wide sloping right lobe + crevices, crate canvas flap (judges: "reads foreign")
// r11 blind A/B vs kept: boulder r11a lost 5.5-6 ("long tapering tail misses the tall upper-left mass"), r11b tied 5.5-5.5: r10a stays.
// Crate r11a (no flap) won 6-5, r11b (olive flap) won 6-5.5, h2h tied 6.5-6.5: kept r11a (wider margin, fewer parts).
// boulder r11a: r10a with the right lobe rebuilt wide and low, sloping down to the right (the reference's long shelf)
const lobeR = () => hull({ mat: "bstM", cap: "bstM", capAngle: 35, jitter: 0.02, seed: 5 }, bm(0.3, 0.5, 0.26, 0.3, -6, 0.55),
  bm(0.3, 0.24, 0.7, 0.42, -16, 0.72), bm(0.54, 0.17, 0.42, 0.34, -14, 0.7))
const boulder_r11a = () => [boulder_v2("bstM", "bstM")[0], lobeR(), CHUNKS.map((a) => chunk(...a, "bstM", "bstM"))]
model("boulder_r11a", boulder_r11a())
// boulder r11b: r11a + crevices cut by subtract(): the seam between body and lobe, two fractures across the front face
const crev = (fx, y, z, rz, ry, len, w = 0.06) => tf({ pos: [fx * BW, y, z], rot: [0, ry, rz] }, box(len, w, 0.5, { mat: "bstM" }))
const cracks = [crev(0.18, 0.3, 0.2, 72, 0, 0.7, 0.08), crev(-0.12, 0.3, 0.3, 14, 0, 0.5), crev(0.42, 0.22, 0.26, 28, -10, 0.4)]
model("boulder_r11b", subtract(boulder_v2("bstM", "bstM")[0], ...cracks), subtract(lobeR(), ...cracks), CHUNKS.map((a) => chunk(...a, "bstM", "bstM")))
// crate r11a: crate_r9b without the grey canvas flap; r11b: the flap kept but painted the crate's olive (a paint-flake, not cloth)
model("crate_r11a", crate_v2().slice(0, -2), stencilTri(), lidText())
model("crate_r11b", crate_v2().slice(0, -2), stencilTri(), lidText(),
  box(0.02, 0.69 * CH, CD + 0.06 * CL, { mat: "cr2W2", pos: [-CL / 2 - 0.012, 0.16 * CH, 0] }),
  extrude([0, 0.844 * CH, 0.14 * CL, 0.844 * CH, 0, 0.6 * CH], 0.012, { mat: "cr2W2", pos: [-CL / 2, 0, CD / 2 + 0.001] }))

// r12 blind A/B vs kept (one fresh sonnet judge per pair): boulder r12a 4.5-4 (marginal win), r12b 6-5; crate r12a 6-5, r12b lost 5-7 (big loop). Kept: boulder_r12b, crate_r12a.
// ---------- round 12 (2026-10-29, night shift): boulder upper-left mass (r11 judges' real gap), crate rope handles
// boulder r12a: r10a + a tall hull over the upper left (two blobs stacked on the left body, peak ~0.95H at fx -0.25); r12b: taller and
// further left, plus a small shoulder chunk. Both reuse the mottle material so the colour stays identical to the champion.
const ulMass = (k = 1) => hull({ mat: "bstM", cap: "bstM", capAngle: 35, jitter: 0.02, seed: 7 }, bm(-0.28, 0.6, 0.42 * k, 0.5, 18, 0.62),
  bm(-0.2, 0.74, 0.36 * k, 0.4 * k, 8, 0.55))
const boulder_r12a = () => [boulder_v2("bstM", "bstM"), ulMass(1), CHUNKS.map((a) => chunk(...a, "bstM", "bstM"))]
model("boulder_r12a", boulder_r12a())
model("boulder_r12b", boulder_v2("bstM", "bstM"), hull({ mat: "bstM", cap: "bstM", capAngle: 35, jitter: 0.02, seed: 8 },
  bm(-0.34, 0.62, 0.4, 0.52, 22, 0.62), bm(-0.27, 0.82, 0.34, 0.5, 14, 0.55), bm(-0.12, 0.7, 0.3, 0.36, 4, 0.5)),
  CHUNKS.map((a) => chunk(...a, "bstM", "bstM")))
// crate r12a: crate_r11a + rope grab handles (open tube loops standing off both end faces, mid-height); r12b: thicker rope, bigger loop
pal({ rope: "#8a7a55" })
const ropeLoop = (sx, r, w, d) => tube([sx * (CL / 2 + 0.002), 0.5 * CH, -w, sx * (CL / 2 + d), 0.5 * CH, -w * 0.6, sx * (CL / 2 + d * 1.15), 0.5 * CH, 0,
  sx * (CL / 2 + d), 0.5 * CH, w * 0.6, sx * (CL / 2 + 0.002), 0.5 * CH, w], r, { mat: "rope", sides: 6 })
model("crate_r12a", crate_v2().slice(0, -2), stencilTri(), lidText(), ropeLoop(-1, 0.012, 0.12, 0.05), ropeLoop(1, 0.012, 0.12, 0.05))
model("crate_r12b", crate_v2().slice(0, -2), stencilTri(), lidText(), ropeLoop(-1, 0.02, 0.15, 0.08), ropeLoop(1, 0.02, 0.15, 0.08))

pack("img2blockout_best", ["broadleaf_v2", "pine_v1", "maple_v5", "boulder_r12b", "barrel_r7", "crate_r12a"])
