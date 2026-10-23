// A mesh is a list of flat, convex, planar polygons with a material key each. Low-poly assets
// are flat-shaded, so faces never share normals and polygon soup is the natural representation.
import { KilnError } from "./errors.ts";
import { type M, type V3, add, apply, cross, det, dot, hash, len, noise3, norm, rng, scl, sub } from "./util.ts";

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
  /** Detail part (nail, rivet, chain): dropped when smaller than the model's feature floor. */
  minor?: boolean;
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

/** Chamfer the sharp edges of a convex shape by `size` (meters): every edge whose faces meet at more than
 * `minAngle` degrees gets a bevel plane, and the solid is rebuilt by clipping against all planes.
 * Concave shapes come back unchanged. Bevel faces take the material of one neighbour. */
export function bevel(faces: Face[], size: number, minAngle = 50): Face[] {
  if (size <= 0 || faces.length < 4) return faces;
  const bb = bounds(faces);
  // Thin parts (sign boards, trims) get a proportionally smaller bevel; true slivers (< 3 mm) are skipped.
  size = Math.min(size, 0.3 * Math.min(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]));
  if (size < 0.003) return faces;
  type Plane = { n: V3; d: number; mat: string; part?: string };
  const planes: Plane[] = [];
  const pid = faces.map((f) => {
    const n = faceNormal(f.v), d = dot(n, f.v[0]);
    let i = planes.findIndex((p) => dot(p.n, n) > 0.9999 && Math.abs(p.d - d) < 1e-6);
    if (i < 0) { planes.push({ n, d, mat: f.mat, part: f.part }); i = planes.length - 1; }
    return i;
  });
  const pts = faces.flatMap((f) => f.v), eps = 1e-6 * (1 + Math.max(...pts.map((p) => Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]))));
  for (const p of planes) for (const q of pts) if (dot(p.n, q) > p.d + eps * 10) return faces;     // concave: leave as is
  // Sharp edges between two different planes become bevel planes.
  const key = (p: V3) => p.map((c) => Math.round(c * 1e5)).join(",");
  const edges = new Map<string, { a: V3; planes: Set<number> }>();
  faces.forEach((f, fi) => f.v.forEach((a, k) => {
    const b = f.v[(k + 1) % f.v.length], ka = key(a), kb = key(b), ek = ka < kb ? ka + "|" + kb : kb + "|" + ka;
    const e = edges.get(ek) ?? edges.set(ek, { a, planes: new Set() }).get(ek)!;
    e.planes.add(pid[fi]);
  }));
  const cosMin = Math.cos((minAngle * Math.PI) / 180), cuts: Plane[] = [], seen = new Set<string>();
  for (const e of edges.values()) {
    if (e.planes.size !== 2) continue;
    const [i, j] = [...e.planes], P = planes[i], Q = planes[j];
    if (dot(P.n, Q.n) > cosMin) continue;
    const n = norm(add(P.n, Q.n)), d = dot(n, e.a) - size, k = `${n.map((c) => c.toFixed(4))}|${d.toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    cuts.push({ n, d, mat: P.n[1] >= Q.n[1] ? Q.mat : P.mat, part: P.part });
  }
  if (!cuts.length) return faces;
  // Rebuild: start from a box around the shape, clip by every plane (Sutherland-Hodgman + cap polygon).
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const q of pts) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], q[c] - 1); hi[c] = Math.max(hi[c], q[c] + 1); }
  const C = (x: number, y: number, z: number): V3 => [x ? hi[0] : lo[0], y ? hi[1] : lo[1], z ? hi[2] : lo[2]];
  let poly: { v: V3[]; mat: string; part?: string }[] = [
    [C(0, 0, 0), C(0, 1, 0), C(1, 1, 0), C(1, 0, 0)], [C(0, 0, 1), C(1, 0, 1), C(1, 1, 1), C(0, 1, 1)],
    [C(0, 0, 0), C(1, 0, 0), C(1, 0, 1), C(0, 0, 1)], [C(0, 1, 0), C(0, 1, 1), C(1, 1, 1), C(1, 1, 0)],
    [C(0, 0, 0), C(0, 0, 1), C(0, 1, 1), C(0, 1, 0)], [C(1, 0, 0), C(1, 1, 0), C(1, 1, 1), C(1, 0, 1)],
  ].map((v) => ({ v, mat: faces[0].mat }));
  for (const pl of [...planes, ...cuts]) {
    const cap: V3[] = [], next: typeof poly = [];
    for (const f of poly) {
      const out: V3[] = [];
      f.v.forEach((a, k) => {
        const b = f.v[(k + 1) % f.v.length], da = dot(pl.n, a) - pl.d, db = dot(pl.n, b) - pl.d;
        if (da <= eps) out.push(a);
        if ((da < -eps && db > eps) || (da > eps && db < -eps)) {
          const x = add(a, scl(sub(b, a), da / (da - db)));
          out.push(x); cap.push(x);
        } else if (Math.abs(da) <= eps) cap.push(a);
      });
      if (out.length >= 3) next.push({ ...f, v: out });
    }
    if (cap.length >= 3) {
      const c = scl(cap.reduce((s, q) => add(s, q), [0, 0, 0] as V3), 1 / cap.length);
      const u = norm(sub(cap[0], c)), w = cross(pl.n, u), uniq: V3[] = [];
      for (const q of cap.sort((a, b) => Math.atan2(dot(sub(a, c), w), dot(sub(a, c), u)) - Math.atan2(dot(sub(b, c), w), dot(sub(b, c), u))))
        if (!uniq.length || Math.hypot(...sub(q, uniq[uniq.length - 1])) > eps * 10) uniq.push(q);
      if (uniq.length > 2 && Math.hypot(...sub(uniq[0], uniq[uniq.length - 1])) <= eps * 10) uniq.pop();
      if (uniq.length >= 3) next.push({ v: uniq, mat: pl.mat, part: pl.part });
    }
    poly = next;
  }
  return poly.map((f) => ({ ...faces[0], v: f.v, mat: f.mat, part: f.part, n: undefined, c: undefined }));
}

/** Convex hull of a point cloud as outward triangles (incremental: a starting tetrahedron, then each outside point
 * replaces the faces it sees, fanning to their horizon). Joins separate masses into one closed shape. */
export function convexHull(points: V3[], mat: string): Face[] {
  const key = (p: V3) => p.map((v) => Math.round(v * 1e5)).join(",");
  const pts = [...new Map(points.map((p) => [key(p), p])).values()];
  if (pts.length < 4) throw new KilnError("hull needs at least 4 distinct points");
  const ext = (cmp: (p: V3) => number) => pts.reduce((a, p) => (cmp(p) > cmp(a) ? p : a));
  const p0 = ext((p) => -p[0]), p1 = ext((p) => len(sub(p, p0)));
  const d01 = norm(sub(p1, p0)), p2 = ext((p) => len(cross(sub(p, p0), d01)));
  const n012 = norm(cross(sub(p1, p0), sub(p2, p0))), p3 = ext((p) => Math.abs(dot(sub(p, p0), n012)));
  const span = len(sub(p1, p0)), eps = span * 1e-7;
  if (len(cross(sub(p2, p0), d01)) < eps || Math.abs(dot(sub(p3, p0), n012)) < eps) throw new KilnError("hull: the points are flat (all in one plane)");
  const ctr = scl(add(add(p0, p1), add(p2, p3)), 0.25);
  type T = { v: [V3, V3, V3]; n: V3; d: number };
  const tri = (a: V3, b: V3, c: V3): T => {
    let n = norm(cross(sub(b, a), sub(c, a)));
    if (dot(n, sub(a, ctr)) < 0) { [b, c] = [c, b]; n = scl(n, -1); }
    return { v: [a, b, c], n, d: dot(n, a) };
  };
  let tris: T[] = [tri(p0, p1, p2), tri(p0, p1, p3), tri(p0, p2, p3), tri(p1, p2, p3)];
  for (const p of pts) {
    const seen = tris.filter((t) => dot(t.n, p) - t.d > eps * 10);
    if (!seen.length) continue;
    const edges = new Map<string, [V3, V3]>();
    for (const t of seen) for (let i = 0; i < 3; i++) {
      const a = t.v[i], b = t.v[(i + 1) % 3], back = key(b) + "|" + key(a);
      if (edges.has(back)) edges.delete(back); else edges.set(key(a) + "|" + key(b), [a, b]);
    }
    const gone = new Set(seen);
    tris = tris.filter((t) => !gone.has(t));
    for (const [a, b] of edges.values()) tris.push(tri(a, b, p));
  }
  return tris.map((t) => ({ v: [...t.v], mat }));
}
