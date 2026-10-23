// A mesh is a list of flat, convex, planar polygons with a material key each. Low-poly assets
// are flat-shaded, so faces never share normals and polygon soup is the natural representation.
import { KilnError } from "./errors.ts";
import { type M, type V3, apply, det, dot, hash, noise3, norm, rng } from "./util.ts";

export interface Face {
  v: V3[];
  mat: string;
  /** Animated part this face belongs to (none = the model's static body). */
  part?: string;
  /** Auto-smooth angle in degrees: edges to faces of the same shape (`sg`) under this angle shade smooth. */
  sm?: number;
  /** Smoothing group: the shape call this face came from. */
  sg?: number;
  /** Per-corner normals, set by smoothNormals() at output time. */
  n?: V3[];
  /** Per-corner baked light (0..1, ambient occlusion), set by bakeAO(); multiplies the material color. */
  c?: number[];
}

/** An animatable part: a named node that rotates / moves / scales about its pivot. */
export interface Joint {
  name: string;
  parent?: string;
  pivot: V3;
}

/** Newell normal (robust for any planar polygon), counter-clockwise = outward. */
export function faceNormal(v: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([x, y, z]);
}

/** Flip a face if it points against `outward` (used by primitives to guarantee CCW-outward). */
export function orient(v: V3[], outward: V3): V3[] {
  return dot(faceNormal(v), outward) < 0 ? v.slice().reverse() : v;
}

/** A punctual light carried with geometry (exported as KHR_lights_punctual). */
export interface Light {
  type: "point" | "spot";
  color: string;
  /** Watts, Blender-style. */
  power: number;
  pos: V3;
  /** Spot direction (unit). */
  dir: V3;
  /** Spot cone half-angle in degrees. */
  angle?: number;
  range?: number;
  part?: string;
}

/** Geometry plus the lights that travel with it through stamps, mirrors and transforms. */
export interface Part {
  faces: Face[];
  lights: Light[];
  joints?: Joint[];
}

/** Rename every part in a bundle (stamp `as`, mirrored copies, scatter instances). */
export function renameParts(p: Part, fn: (n: string) => string): Part {
  if (!p.joints?.length) return p;
  return {
    faces: p.faces.map((f) => (f.part ? { ...f, part: fn(f.part) } : f)),
    lights: p.lights.map((l) => (l.part ? { ...l, part: fn(l.part) } : l)),
    joints: p.joints.map((j) => ({ name: fn(j.name), parent: j.parent && fn(j.parent), pivot: j.pivot })),
  };
}

export function transformLights(lights: Light[], m: M): Light[] {
  return lights.map((l) => {
    const o = apply(m, [0, 0, 0]), d = apply(m, l.dir);
    return { ...l, pos: apply(m, l.pos), dir: norm([d[0] - o[0], d[1] - o[1], d[2] - o[2]]) };
  });
}

export function transformPart(p: Part, m: M): Part {
  return { faces: transform(p.faces, m), lights: transformLights(p.lights, m), joints: p.joints?.map((j) => ({ ...j, pivot: apply(m, j.pivot) })) };
}

export function transform(faces: Face[], m: M): Face[] {
  const flip = det(m) < 0;
  return faces.map((f) => {
    const v = f.v.map((p) => apply(m, p));
    return { ...f, v: flip ? v.reverse() : v };
  });
}

export function recolor(faces: Face[], swap: Record<string, string>): Face[] {
  return faces.map((f) => (swap[f.mat] ? { ...f, mat: swap[f.mat] } : f));
}

/** Move welded vertices together by up to `amount` (deterministic): the classic low-poly wobble. */
/** With `wobble` (feature size in meters) the offset is smooth noise instead, so extra detail stays coherent. */
export function jitter(faces: Face[], amount: number, seed: number, wobble?: number): Face[] {
  const moved = new Map<string, V3>();
  const at = (p: V3): V3 => {
    const k = p.map((c) => Math.round(c * 1e4)).join(",");
    let o = moved.get(k);
    if (!o) {
      if (wobble) {
        const f = 1 / wobble, n = (c: number) => noise3(p[0] * f + c * 17.3, p[1] * f + c * 5.1, p[2] * f + c * 11.7, seed) * amount;
        o = [p[0] + n(0), p[1] + n(1), p[2] + n(2)];
        moved.set(k, o);
        return o;
      }
      const r = rng(hash(k) ^ seed);
      o = [p[0] + (r() * 2 - 1) * amount, p[1] + (r() * 2 - 1) * amount, p[2] + (r() * 2 - 1) * amount];
      moved.set(k, o);
    }
    return o;
  };
  // Polygons with more than 3 corners would turn non-planar: triangulate first.
  return triangulate(faces).map((f) => ({ ...f, v: f.v.map(at) }));
}

/** Fan triangulation (faces are convex). */
export function triangulate(faces: Face[]): Face[] {
  const out: Face[] = [];
  for (const f of faces) {
    if (f.v.length === 3) { out.push(f); continue; }
    for (let i = 1; i < f.v.length - 1; i++) out.push({ ...f, v: [f.v[0], f.v[i], f.v[i + 1]], n: f.n && [f.n[0], f.n[i], f.n[i + 1]], c: f.c && [f.c[0], f.c[i], f.c[i + 1]] });
  }
  return out;
}

export interface Bounds {
  min: V3;
  max: V3;
}

export function bounds(faces: Face[]): Bounds {
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const f of faces)
    for (const p of f.v)
      for (let i = 0; i < 3; i++) { if (p[i] < min[i]) min[i] = p[i]; if (p[i] > max[i]) max[i] = p[i]; }
  if (!faces.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

export function triCount(faces: Face[]): number {
  return faces.reduce((a, f) => a + f.v.length - 2, 0);
}

/** Ear-clipping triangulation of a simple 2D polygon (any winding). Returns index triples. */
export function earClip(pts: [number, number][]): [number, number, number][] {
  const n = pts.length;
  if (n < 3) throw new KilnError("a polygon needs at least 3 points");
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const idx = Array.from({ length: n }, (_, i) => i);
  if (area < 0) idx.reverse();
  const crossZ = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p: number[], a: number[], b: number[], c: number[]) => crossZ(a, b, p) >= 0 && crossZ(b, c, p) >= 0 && crossZ(c, a, p) >= 0;
  const out: [number, number, number][] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (crossZ(a, b, c) <= 1e-12) continue;
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && inside(pts[j], a, b, c))) continue;
      out.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new KilnError("polygon is self-intersecting; points must trace the outline without crossing");
  }
  out.push([idx[0], idx[1], idx[2]]);
  return out;
}


/** Triangles with per-corner normals for faces that have `sm`: each corner averages the (area-weighted)
 * normals of same-group faces meeting there whose angle to this face is under both faces' threshold.
 * Sharper edges keep a hard crease. Faces without `sm` stay flat. */
export function smoothNormals(faces: Face[]): Face[] {
  const tris = triangulate(faces);
  if (!tris.some((t) => t.sm)) return tris;
  const key = (t: Face, p: V3) => `${t.sg}|${p.map((c) => Math.round(c * 1e4)).join(",")}`;
  const area: V3[] = tris.map((t) => {
    const [a, b, c] = t.v, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  });
  const unit = area.map((a) => norm(a));
  const at = new Map<string, number[]>();
  tris.forEach((t, i) => { if (t.sm) for (const p of t.v) { const k = key(t, p); (at.get(k) ?? at.set(k, []).get(k)!).push(i); } });
  return tris.map((t, i) => {
    if (!t.sm) return t;
    const n = t.v.map((p) => {
      const s: V3 = [0, 0, 0];
      for (const j of at.get(key(t, p))!) {
        if (dot(unit[i], unit[j]) < Math.cos((Math.min(t.sm!, tris[j].sm!) * Math.PI) / 180)) continue;
        s[0] += area[j][0]; s[1] += area[j][1]; s[2] += area[j][2];
      }
      return norm(s);
    });
    return { ...t, n };
  });
}

/** Bake ambient occlusion into per-corner colors: each corner's view of an open sky (with an infinite
 * ground below the model) over `dirs` directions, via orthographic depth maps. strength 0..1 = how dark
 * a fully enclosed corner gets. Also adds a gentle bottom-to-top gradient. Keeps faces as they are. */
export function bakeAO(faces: Face[], strength: number, dirs = 32, res = 96): Face[] {
  if (!faces.length || strength <= 0) return faces;
  const tris = triangulate(faces), b = bounds(faces);
  const size = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) || 1, eps = size * 0.015;
  const ctr: V3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  // Directions: Fibonacci sphere; those pointing into the ground (y < 0) are always blocked.
  const D: V3[] = [];
  for (let i = 0; i < dirs; i++) {
    const y = 1 - (2 * (i + 0.5)) / dirs, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
    D.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  const maps = D.map((d) => {
    if (d[1] < -0.05) return undefined;
    const u = norm(Math.abs(d[1]) > 0.9 ? [1, 0, 0].map((x, k) => x - d[k] * d[0]) as V3 : [d[2], 0, -d[0]]);
    const v: V3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const half = size * 0.9, cell = (2 * half) / res, depth = new Float32Array(res * res).fill(-Infinity);
    const prj = (p: V3) => { const q: V3 = [p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2]]; return [(dot(q, u) + half) / cell, (dot(q, v) + half) / cell, dot(q, d)]; };
    for (const t of tris) {
      const [A, B, C] = t.v.map(prj);
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(area) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(res - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(res - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area, w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area, w2 = 1 - w0 - w1;
          if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
          const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
          if (z > depth[y * res + x]) depth[y * res + x] = z;
        }
    }
    return { prj, depth };
  });
  const h = b.max[1] - b.min[1] || 1;
  return faces.map((f) => {
    const fn = faceNormal(f.v);
    const c = f.v.map((p, k) => {
      const n = f.n?.[k] ?? fn, q: V3 = [p[0] + n[0] * eps, p[1] + n[1] * eps, p[2] + n[2] * eps];
      let seen = 0, total = 0;
      D.forEach((d, i) => {
        const w = dot(d, n);
        if (w <= 0) return;
        total += w;
        const m = maps[i];
        if (!m) return;
        const [x, y, z] = m.prj(q), xi = Math.floor(x), yi = Math.floor(y);
        const block = xi >= 0 && yi >= 0 && xi < res && yi < res ? m.depth[yi * res + xi] : -Infinity;
        if (block <= z + eps) seen += w;
      });
      const vis = total ? seen / total : 1, grad = 0.88 + 0.12 * Math.min(1, Math.max(0, (p[1] - b.min[1]) / h));
      return Math.max(0, Math.min(1, (1 - strength * (1 - vis)) * (1 - strength * (1 - grad))));
    });
    return { ...f, c };
  });
}
