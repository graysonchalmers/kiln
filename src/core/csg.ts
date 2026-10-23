// Boolean subtract on closed polygon meshes: a BSP-tree CSG (after Evan Wallace's csg.js, MIT). Faces stay flat convex
// polygons, so splitting keeps them valid. Kept faces keep their material; the walls a cutter carves take the cutter's
// material (a crack's dark inside, a recessed panel's shadow).
import type { Face } from "./mesh.ts";
import { type V3, cross, dot, norm, sub } from "./util.ts";

const EPS = 1e-5;
type Plane = { n: V3; w: number };
const planeOf = (v: V3[]): Plane => { const n = norm(cross(sub(v[1], v[0]), sub(v[2], v[0]))); return { n, w: dot(n, v[0]) } };
const flip = (f: Face): Face => ({ ...f, v: [...f.v].reverse() });
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Sort `f` against plane `p` into the four lists (coplanar faces go front or back by facing). */
function split(p: Plane, f: Face, cf: Face[], cb: Face[], fr: Face[], bk: Face[]) {
  const t = f.v.map((v) => { const d = dot(p.n, v) - p.w; return d < -EPS ? 2 : d > EPS ? 1 : 0 });
  const all = t.reduce((a: number, b) => a | b, 0);
  if (all === 0) (dot(p.n, planeOf(f.v).n) > 0 ? cf : cb).push(f);
  else if (all === 1) fr.push(f);
  else if (all === 2) bk.push(f);
  else {
    const F: V3[] = [], B: V3[] = [];
    for (let i = 0; i < f.v.length; i++) {
      const j = (i + 1) % f.v.length, ti = t[i], tj = t[j], vi = f.v[i], vj = f.v[j];
      if (ti !== 2) F.push(vi);
      if (ti !== 1) B.push(vi);
      if ((ti | tj) === 3) {
        const v = lerp(vi, vj, (p.w - dot(p.n, vi)) / dot(p.n, sub(vj, vi)));
        F.push(v); B.push(v);
      }
    }
    const piece = (v: V3[]): Face => { const { n: _n, c: _c, ...rest } = f; return { ...rest, v } };
    if (F.length >= 3) fr.push(piece(F));
    if (B.length >= 3) bk.push(piece(B));
  }
}

class Node {
  plane?: Plane; front?: Node; back?: Node; faces: Face[] = [];
  constructor(faces?: Face[]) { if (faces) this.build(faces); }
  invert() {
    this.faces = this.faces.map(flip);
    if (this.plane) this.plane = { n: [-this.plane.n[0], -this.plane.n[1], -this.plane.n[2]], w: -this.plane.w };
    this.front?.invert(); this.back?.invert();
    [this.front, this.back] = [this.back, this.front];
  }
  clip(faces: Face[]): Face[] {
    if (!this.plane) return faces.slice();
    let fr: Face[] = [], bk: Face[] = [];
    for (const f of faces) split(this.plane, f, fr, bk, fr, bk);
    fr = this.front ? this.front.clip(fr) : fr;
    bk = this.back ? this.back.clip(bk) : [];
    return fr.concat(bk);
  }
  clipTo(b: Node) { this.faces = b.clip(this.faces); this.front?.clipTo(b); this.back?.clipTo(b); }
  all(): Face[] { return [...this.faces, ...(this.front?.all() ?? []), ...(this.back?.all() ?? [])]; }
  build(faces: Face[]) {
    if (!faces.length) return;
    this.plane ??= planeOf(faces[0].v);
    const fr: Face[] = [], bk: Face[] = [];
    for (const f of faces) split(this.plane, f, this.faces, this.faces, fr, bk);
    if (fr.length) (this.front ??= new Node()).build(fr);
    if (bk.length) (this.back ??= new Node()).build(bk);
  }
}

/** a minus b (both closed, outward-facing). */
export function subtract(a: Face[], b: Face[]): Face[] {
  const A = new Node(a), B = new Node(b);
  A.invert(); A.clipTo(B); B.clipTo(A); B.invert(); B.clipTo(A); B.invert();
  A.build(B.all()); A.invert();
  return A.all();
}
