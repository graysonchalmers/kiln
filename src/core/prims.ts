// Low-poly primitives. Boxes, cylinders, cones, lathes, prisms and extrusions sit on y = 0
// (centered in x/z); spheres and rocks are centered on the origin. Every face is CCW-outward.
import { KilnError } from "./errors.ts";
import { type Face, earClip, orient } from "./mesh.ts";
import { type V3, add, norm, rng, scl, sub } from "./util.ts";

export function box(w: number, h: number, d: number, mat: string): Face[] {
  const x = w / 2, z = d / 2;
  const c: V3 = [0, h / 2, 0];
  const quads: V3[][] = [
    [[-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]], [[x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z]],
    [[x, 0, z], [x, 0, -z], [x, h, -z], [x, h, z]], [[-x, 0, -z], [-x, 0, z], [-x, h, z], [-x, h, -z]],
    [[-x, h, z], [x, h, z], [x, h, -z], [-x, h, -z]], [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]],
  ];
  return quads.map((v) => ({ v: orient(v, sub(centroid(v), c)), mat }));
}

function centroid(v: V3[]): V3 {
  return scl(v.reduce((a, p) => add(a, p), [0, 0, 0] as V3), 1 / v.length);
}

function ring(r: number, y: number, sides: number): V3[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    return [Math.sin(a) * r, y, Math.cos(a) * r] as V3;
  });
}

/** Revolve a profile of [radius, y] points (bottom to top) around the Y axis. */
export function lathe(profile: [number, number][], sides: number, mat: string): Face[] {
  if (profile.length < 2) throw new KilnError("lathe needs at least 2 [radius, y] points");
  if (!(sides >= 3)) throw new KilnError("sides must be >= 3");
  const rings = profile.map(([r, y]) => ring(r, y, sides));
  const faces: Face[] = [];
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
    const nr = y1 - y0, ny = -(r1 - r0);                       // outward normal in the (r, y) plane
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = rings[k][i], b = rings[k][j], c = rings[k + 1][j], d = rings[k + 1][i];
      const mid = norm(add(a, b).map((v, n) => (n === 1 ? 0 : v)) as V3);
      const out = add(scl(mid, nr), [0, ny, 0]);
      const v = r0 < 1e-9 ? [a, c, d] : r1 < 1e-9 ? [a, b, c] : [a, b, c, d];
      if (r0 < 1e-9 && r1 < 1e-9) continue;
      faces.push({ v: orient(v, out), mat });
    }
  }
  const capAt = (k: number, down: boolean) => {
    const [r, y] = profile[k];
    if (r > 1e-9) faces.push({ v: orient(rings[k], [0, down ? -1 : 1, 0]), mat });
    return y;
  };
  capAt(0, profile[0][1] <= profile[profile.length - 1][1]);
  capAt(profile.length - 1, profile[0][1] > profile[profile.length - 1][1]);
  return faces;
}

export const cyl = (r: number, h: number, sides: number, r2: number, mat: string) => lathe([[r, 0], [r2, h]], sides, mat);

/** Gable prism (a roof): triangle of width w and height h in X/Y, depth d along Z. */
export function prism(w: number, h: number, d: number, mat: string): Face[] {
  return extrude([[-w / 2, 0], [w / 2, 0], [0, h]], d, mat);
}

/** Ramp: full height at the back (-z), down to 0 at the front (+z). */
export function wedge(w: number, h: number, d: number, mat: string): Face[] {
  const x = w / 2, z = d / 2, c: V3 = [0, h / 3, -z / 3];
  const polys: V3[][] = [
    [[-x, 0, z], [x, 0, z], [x, h, -z], [-x, h, -z]], [[-x, 0, -z], [x, 0, -z], [x, h, -z], [-x, h, -z]],
    [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]], [[x, 0, z], [x, 0, -z], [x, h, -z]], [[-x, 0, z], [-x, 0, -z], [-x, h, -z]],
  ];
  return polys.map((v) => ({ v: orient(v, sub(centroid(v), c)), mat }));
}

/** Extrude a 2D outline (X/Y, any simple polygon) along Z, centered. */
export function extrude(pts: [number, number][], depth: number, mat: string): Face[] {
  const tris = earClip(pts);
  const z = depth / 2, faces: Face[] = [];
  for (const [a, b, c] of tris) {
    faces.push({ v: orient([[...pts[a], z], [...pts[b], z], [...pts[c], z]] as V3[], [0, 0, 1]), mat });
    faces.push({ v: orient([[...pts[a], -z], [...pts[b], -z], [...pts[c], -z]] as V3[], [0, 0, -1]), mat });
  }
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const out: V3 = area > 0 ? [dy, -dx, 0] : [-dy, dx, 0];
    faces.push({ v: orient([[p[0], p[1], z], [p[0], p[1], -z], [q[0], q[1], -z], [q[0], q[1], z]], out), mat });
  }
  return faces;
}

/** Indexed icosphere. */
function ico(detail: number): { pts: V3[]; tris: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  let pts: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => norm(p as V3));
  let tris: [number, number, number][] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let k = 0; k < detail; k++) {
    const cache = new Map<string, number>(), next: [number, number, number][] = [];
    const mid = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      let i = cache.get(key);
      if (i === undefined) { i = pts.length; pts.push(norm(scl(add(pts[a], pts[b]), 0.5))); cache.set(key, i); }
      return i;
    };
    for (const [a, b, c] of tris) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    tris = next;
  }
  pts = pts.slice();
  return { pts, tris };
}

export function sphere(r: number, detail: number, mat: string): Face[] {
  if (!(detail >= 0 && detail <= 4)) throw new KilnError("detail must be 0..4");
  const { pts, tris } = ico(detail);
  return tris.map(([a, b, c]) => {
    const v: V3[] = [scl(pts[a], r), scl(pts[b], r), scl(pts[c], r)];
    return { v: orient(v, add(add(v[0], v[1]), v[2])), mat };
  });
}

/** A rock: an icosphere with each vertex pushed in or out, optionally squashed. */
export function rock(r: number, detail: number, rough: number, squash: number, seed: number, mat: string): Face[] {
  const { pts, tris } = ico(detail);
  const rr = rng(seed);
  const moved = pts.map((p) => {
    const k = 1 + (rr() * 2 - 1) * rough;
    return [p[0] * r * k, p[1] * r * k * squash, p[2] * r * k] as V3;
  });
  return tris.map(([a, b, c]) => {
    const v: V3[] = [moved[a], moved[b], moved[c]];
    return { v: orient(v, add(add(v[0], v[1]), v[2])), mat };
  });
}
