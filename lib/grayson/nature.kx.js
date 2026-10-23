// Grayson nature recipes for kiln. Load with include("<rel>/lib/grayson/nature.kx.js").
// Each returns shape items; tones default to leaf/leafL/leafD, bark, stone/stoneL, flame/flameL.
// Distilled from the 2026-10-22 nature-kit review (text-to-glb references/what-good-looks-like.md).
include("./detail.kx.js")


// Broadleaf canopy: uneven clump of jittered spheres, light on top, dark under, off-center.
// wild (0..1) = how far from tidy; organic default 0.6.
function canopy(r, { at = [0, 0, 0], seed = 1, tones = ["leaf", "leafL", "leafD"], puffs = 5, wild = 0.6 } = {}) {
  const [x, y, z] = at, rnd = _r(seed * 97 + 13), j = () => (rnd() - 0.5) * 2 * wild
  const out = [sphere(r, { mat: tones[0], pos: [x + j() * r * 0.2, y, z + j() * r * 0.2], scale: [1.1 + j() * 0.2, 0.8 + j() * 0.1, 0.95 + j() * 0.2], wobble: WB(), jitter: 0.08, seed, detail: SD(1) })]
  for (let i = 1; i < N(puffs, 2); i++) {
    const a = rnd() * 6.28, up = rnd() < 0.55 ? 0.3 + rnd() * 0.35 : -0.25 + rnd() * 0.2
    out.push(sphere(r * (0.4 + rnd() * 0.35), { mat: up > 0.2 ? tones[1] : up < 0 ? tones[2] : tones[0],
      pos: [x + Math.cos(a) * r * (0.45 + rnd() * 0.4), y + up * r, z + Math.sin(a) * r * (0.4 + rnd() * 0.35)],
      scale: [1, 0.8 + rnd() * 0.3, 1], wobble: WB(), jitter: 0.07, seed: seed + i, detail: SD(1) }))
  }
  return out
}

// Conifer: stacked cones, alternating tones; tiers drift and tilt slightly (wild 0 = perfect).
function conifer(h, { r = h * 0.32, tiers = 4, seed = 10, tones = ["leafD", "leaf", "leaf", "leafL"], trunk = "barkD", wild = 0.5 } = {}) {
  const base = h * 0.2, rnd = _r(seed * 31 + 5), j = () => (rnd() - 0.5) * 2 * wild
  return [cyl(r * 0.15, base + 0.1, { mat: trunk, sides: S(5) }),
    ...[...Array(tiers)].map((_, i) => {
      const t = i / tiers
      return cone(r * (1 - t * 0.68) * (1 + j() * 0.12), (h - base) * (0.45 - t * 0.12), { mat: tones[Math.min(tones.length - 1, Math.floor(t * tones.length))], sides: S(7),
        pos: [j() * r * 0.08, base + (h - base) * t * 0.78, j() * r * 0.08], rot: [j() * 6, i * 23 + j() * 20, j() * 6], wobble: WB(), jitter: 0.045, seed: seed + i })
    })]
}

// Trunk + branches. lean: [dx, dz] top offset in meters (the upper trunk bends). branches: tip points.
// One tube, one mesh (2026-10-23 swamp round 2): radius per point = taper (base r -> taper x r at the crown) times a
// concave root flare (flare x at the ground, decaying over k = 7% of h; 0 = none). A separate flare mesh showed a
// smoothing seam (a collar) at the join. Branches taper to 30%.
function trunk(h, { r = 0.15, mat = "bark", branches = [], lean = [0, 0], taper = 0.5, flare = 1.8 } = {}) {
  const [lx, lz] = lean, at = (y) => { const t = y / h; return [lx * t * t, lz * t * t] }
  const k = h * 0.07, qs = flare > 1 ? [0, 0.3, 0.7, 1.2, 2, 3.5] : [0]
  const ys = [...qs.map(q => q * k), ...[0.35, 0.6, 0.82, 1].map(t => t * h)]
  const rad = ys.map((y, i) => r * (1 - (1 - taper) * y / h) * (i < qs.length && flare > 1 ? 1 + (flare - 1) * Math.exp(-qs[i]) : 1))
  const body = tube(ys.flatMap(y => { const [x, z] = at(y); return [x, y, z] }), rad, { mat, sides: S(7), jitter: 0.01, seed: 101 })
  return [body, ...branches.map(([x, y, z], i) => {
    const [ox, oz] = at(y * 0.7), br = r * 0.45 * (1 - i * 0.1)
    return tube([ox, y * 0.7, oz, (x + ox) * 0.5, y * 0.88, (z + oz) * 0.5, x, y, z], br, { mat, top: br * 0.3 })
  })]
}

// Grass/reed blades: thin 3-sided cones with random tilt.
// bend (0..1, round 3): the tip leans out by bend x height along a curve (a tapered tube), blades arch outward instead of
// standing as straight knives. 0 = the old straight cones.
function blades(n, { h = 0.4, spread = 0.12, seed = 1, tones = ["grass", "grassD"], sides = 3, w = 0.04, bend = 0 } = {}) {
  const rnd = _r(seed + 7)
  return [...Array(N(n))].map((_, i) => {
    const a = rnd() * 6.28, d = rnd() * spread, hh = h * (0.75 + rnd() * 0.5), mat = tones[i % tones.length]
    if (bend > 0) {
      const b = bend * (0.6 + rnd() * 0.8), ts = [0, 0.3, 0.55, 0.8, 1]
      return tube(ts.flatMap(t => { const o = d + b * hh * t * t; return [Math.cos(a) * o, hh * t * (1 - 0.25 * b * t * t), Math.sin(a) * o] }),
        ts.map(t => w * (1 - t * 0.9)), { mat, sides: S(sides) })
    }
    return cone(w, hh, { mat, sides: S(sides),
      pos: [Math.cos(a) * d, 0, Math.sin(a) * d], rot: [(rnd() - 0.5) * 36, rnd() * 360, (rnd() - 0.5) * 36] })
  })
}

// One solid tapered leaf strip along an arch: segs flat trapezoids chained tip to tip (~12 tris/seg).
// Base at origin, grows toward +z. w0 = base width, tip tapers to w0*tip. thick = blade depth.
function leaf(L, { w0 = 0.12, tip = 0.1, lift = 0.4, droop = 0.45, segs = 4, mat = "leaf", tipMat = mat, thick = 0.012, zig = 0, vee = 0 } = {}) {
  const yAt = (t) => lift * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) - lift * droop * Math.max(0, t - 0.6) / 0.4
  const out = []
  segs = S(segs, 1)
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs, t1 = (k + 1) / segs
    const dy = yAt(t1) - yAt(t0), dz = L * (t1 - t0), len = Math.hypot(dy, dz)
    const wa = w0 * (1 - (1 - tip) * t0) / 2, wb = w0 * (1 - (1 - tip) * t1) / 2
    const pts = zig ? [-wa, 0, wa, 0, wb * (1 + zig), len * 0.5, wb, len, -wb, len, -wb * (1 + zig), len * 0.5] : [-wa, 0, wa, 0, wb, len, -wb, len]
    const m = t1 > 0.55 ? tipMat : mat, place = { pos: [0, yAt(t0), L * t0], rot: [90 - Math.atan2(dy, dz) * 57.3, 0, 0] }
    // vee: two half-blades rolled up ±vee° about the midrib = V-section (succulents, grass blades)
    out.push(vee ? tf(place, ...[1, -1].map(sg => extrude(pts.map((v, i) => i % 2 ? v : Math.max(0, v * sg)), thick, { mat: m, rot: [0, sg * vee, 0] })))
      : extrude(pts, thick, { mat: m, ...place }))
  }
  return out
}

// Rosette of solid arched leaves (ferns, palms, agave, hosta). Every leaf gets its own angle,
// length, arch and droop (wild 0 = perfect radial). ~50 tris per leaf at segs 4.
function fronds(n, { len = 0.5, lift = 0.45, w0 = 0.14, tip = 0.1, seed = 1, tones = ["leaf", "leafL"], segs = 4, spread = 0, wild = 0.6, thick = 0.012, zig = 0.35, droop = 0.45, vee = 0, tipTones = tones } = {}) {
  const rnd = _r(seed * 53 + 3), j = () => (rnd() - 0.5) * 2 * wild
  n = N(n, 3)
  return [...Array(n)].map((_, i) => tf({ rot: [spread + j() * 10, i * (360 / n) + j() * (180 / n) + seed * 11, j() * 12] },
    leaf(len * (1 + j() * 0.3), { w0: w0 * (1 + j() * 0.25), tip, lift: lift * (1 + j() * 0.35), droop: droop * (1 + j() * 0.6),
      segs, mat: tones[i % tones.length], tipMat: tipTones[(i + 1) % tipTones.length], thick, zig, vee })))
}

// Layered flame: outer orange, inner yellow, side lick, plus a point light.
function flame(h, { at = [0, 0, 0], power = 80, tones = ["flame", "flameL"] } = {}) {
  const [x, y, z] = at
  return [cone(h * 0.42, h * 0.8, { mat: tones[0], sides: S(5), pos: [x, y, z], wobble: WB(), jitter: 0.05, seed: 1 }),
    cone(h * 0.25, h, { mat: tones[1], sides: S(5), pos: [x + 0.03, y + 0.02, z + 0.02], rot: [0, 30, 4], wobble: WB(), jitter: 0.05, seed: 2 }),
    cone(h * 0.17, h * 0.6, { mat: tones[0], sides: S(4), pos: [x - h * 0.2, y + 0.02, z - 0.04], rot: [0, 10, -12], seed: 3 }),
    light({ type: "point", color: "#ff9a40", power, pos: [x, y + h * 1.8, z + 0.2] })]
}

// Rock with moss on its top faces (not a lid).
// flat (0..1): cut the underside flat so it sits on the ground (default 0.3, 2026-10-23 swamp round 2: rocks pinched to a point).
// Moss is the rock's own up-facing faces (`cap`, round 3): a second shell laid over it poked through and risked z-fighting.
function mossRock(r, { seed = 1, squash = 0.65, rock: rm = "stone", moss = "moss", flat = 0.3, cover = 55 } = {}) {
  return [rock(r, { mat: rm, seed, squash, flat, cap: moss, capAngle: cover, detail: SD(1), wobble: WB(r * 2) })]
}

// Scatter of small low-tri stones (gravel, pebbles).
function gravel(n, { r = 0.06, area = 0.3, seed = 50, tones = ["stone", "stoneL"] } = {}) {
  const rnd = _r(seed)
  return [...Array(n)].map((_, i) => rock(r * (0.6 + rnd() * 0.8), { mat: tones[i % 2], seed: seed + i, squash: 0.5, detail: SD(0),
    pos: [(rnd() - 0.5) * area * 2, 0, (rnd() - 0.5) * area * 2] }))
}

// Crystal cluster: one tall spike plus fanned-out smaller ones.
function crystals(h, { n = 5, mat = "crystal", base = "stoneD", seed = 60 } = {}) {
  const rnd = _r(seed)
  return [rock(h * 0.3, { mat: base, seed, squash: 0.4 }),
    ...[...Array(n)].map((_, i) => {
      const a = (i / n) * 360 + rnd() * 30, tilt = i ? 25 + rnd() * 20 : 0
      return tf({ rot: [0, a, 0] }, cone(h * (i ? 0.12 : 0.16), h * (i ? 0.45 + rnd() * 0.3 : 1), { mat, sides: S(5), pos: [i ? h * 0.12 : 0, 0, 0], rot: [0, 0, -tilt] }))
    })]
}

// Curled fern fiddlehead: stalk + coiled tip (a few shrinking tori).
function fiddlehead(h, { mat = "leafL", at = [0, 0, 0], rot = 0 } = {}) {
  return tf({ pos: at, rot: [0, rot, 0] }, tube([0, 0, 0, 0, h * 0.7, 0.02, 0, h, h * 0.15], 0.012, { mat }),
    torus(h * 0.12, 0.014, { mat, rot: [0, 0, 90], pos: [0, h * 1.02, h * 0.25], rings: S(8), sides: S(4) }),
    torus(h * 0.06, 0.012, { mat, rot: [0, 0, 90], pos: [0, h * 1.02, h * 0.25], rings: S(6), sides: S(4) }))
}
