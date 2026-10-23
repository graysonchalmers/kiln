// Image -> blockout (2026-10-23): reference image -> image-decomp spec -> recipe picks -> this scene -> likeness + blind
// judge against the image. Refs: Quaternius Stylized Nature (CC0) crops in .proof/2026-10-23-img2blockout/refs.
include("../lib/grayson/nature.kx.js")
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
model("pine_v1",
  trunk(PH * 0.42, { r: PH * 0.03, flare: 1.7, taper: 0.6, mat: "pbark", lean: [PH * 0.02, 0] }),
  tube([-0.08 * PH, 0.2 * PH, 0, -0.14 * PH, 0.17 * PH, 0.02, -0.19 * PH, 0.13 * PH, 0.03], 0.014, { mat: "ptwig", top: 0.006 }),
  tube([0.04 * PH, 0.21 * PH, 0, 0.14 * PH, 0.2 * PH, -0.02, 0.23 * PH, 0.18 * PH, -0.03], 0.014, { mat: "ptwig", top: 0.006 }),
  [[0.24, 0.21, -0.04], [0.40, 0.31, 0.02], [0.54, 0.25, 0.03], [0.60, 0.23, 0.04], [0.66, 0.19, 0.045], [0.72, 0.18, 0.055], [0.78, 0.15, 0.065]]
    .map(([h, hw, x], i) => tf({ pos: [x * PH, h * PH, 0] },
      cone(hw * PH * 0.72, PH * 0.13, { mat: "pinD", sides: S(8), pos: [0, -PH * 0.07, 0], jitter: 0.02, seed: i }),
      fronds(8, { len: hw * PH, lift: 0.04, droop: 0.9, w0: hw * PH * 0.55, tip: 0.15, zig: 0.45, wild: 0.5, seed: 7 + i, tones: ["pin", "pinL"], thick: 0.03 }))),
  tf({ pos: [0.08 * PH, 0.86 * PH, 0] }, cone(0.11 * PH, 0.14 * PH, { mat: "pin", sides: S(6), jitter: 0.02 }),
    fronds(4, { len: 0.1 * PH, lift: 0.12, droop: 0.2, w0: 0.06 * PH, zig: 0.4, seed: 3, tones: ["pinL", "pin"], thick: 0.03 })))

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
model("broadleaf_v2",
  tube([0.012 * BH, 0, 0, 0.008 * BH, 0.085 * BH, 0, -0.005 * BH, 0.18 * BH, 0, -0.02 * BH, 0.36 * BH, 0, -0.045 * BH, 0.46 * BH, 0, -0.066 * BH, 0.58 * BH, 0],
    [0.1, 0.085, 0.07, 0.055, 0.047, 0.04].map(r => r * BH), { mat: "blBark", sides: S(7), jitter: 0.01 }),
  tube([-0.06 * BH, 0.42 * BH, 0, -0.1 * BH, 0.43 * BH, 0.02], 0.012 * BH, { mat: "blBarkD", top: 0.006 * BH }),
  blobe(-0.01, 0.82, 0.175, 0.15, 1), blobe(-0.03, 0.66, 0.15, 0.15, 2, 0.05), blobe(-0.19, 0.67, 0.15, 0.15, 3),
  blobe(-0.12, 0.52, 0.12, 0.09, 4), blobe(0.1, 0.6, 0.13, 0.13, 5), blobe(-0.06, 0.7, 0.14, 0.14, 6, -0.12))

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

// Kept after the blind A/B against each reference (2026-10-23): broadleaf v2 (7 vs 4), pine v1 (6 vs 4: v2 over-drooped),
// maple v2 (6 vs 5, near tie: v2 lost the visible trunk and the 45 deg diagonal).
pack("img2blockout_best", ["broadleaf_v2", "pine_v1", "maple_v2"])
