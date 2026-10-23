// A small flat-shading software rasterizer: perspective camera orbiting the model, z-buffer,
// world-fixed key + fill light, hemispheric ambient, emissive glow, a ground grid with a cast
// shadow, and 2x supersampling. It is the agent's eyes; Blender is the beauty renderer.
import { type Face, type Bounds, type Light, faceNormal, smoothNormals, triangulate } from "./mesh.ts";
import { type Palette, boxUV, srgbToLinear } from "./palette.ts";
import { type V3, add, cross, dot, len, norm, scl, sub } from "./util.ts";

export interface ViewOpts {
  yaw?: number;
  pitch?: number;
  w?: number;
  h?: number;
  /** Ground grid + shadow (default true). */
  ground?: boolean;
  /** Fit to these bounds instead of the faces' own (keeps step replay framing steady). */
  fit?: Bounds;
  /** Scene lights: when present the view switches to night (dim moon, lights do the work). */
  lights?: Light[];
  /** "day": daylight even with lights (they add on top, as in a lit engine scene); "night": always night. */
  mood?: "day" | "night";
}

/** Light reaching a face from punctual lights (flat: evaluated at the face center). */
function punctual(lights: Light[], c: V3, n: V3): V3 {
  const out: V3 = [0, 0, 0];
  for (const l of lights) {
    const L = sub(l.pos, c), d2 = Math.max(0.04, dot(L, L)), Ln = scl(L, 1 / Math.sqrt(d2));
    let k = Math.max(0, dot(n, Ln)) * l.power * 0.034 / d2;
    if (l.type === "spot") {
      const outer = Math.cos(((l.angle ?? 35) * Math.PI) / 180), inner = Math.cos(((l.angle ?? 35) * 0.7 * Math.PI) / 180);
      const cd = -dot(Ln, l.dir);
      k *= Math.max(0, Math.min(1, (cd - outer) / Math.max(1e-6, inner - outer)));
    }
    if (l.range) k *= Math.max(0, 1 - Math.sqrt(d2) / l.range);
    if (k <= 0) continue;
    const col = srgbToLinear(l.color);
    out[0] += col[0] * k; out[1] += col[1] * k; out[2] += col[2] * k;
  }
  return out;
}

const LIGHT = norm([-0.5, 0.85, 0.6]);
const FILL = norm([0.7, 0.3, -0.5]);

/** Grid spacing for a model of this size: 0.1, 0.25, 0.5, 1, 2, 5 ... units. */
export function gridStep(radius: number): number {
  return [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50].find((s) => radius / s <= 6) ?? 100;
}

const toSrgb = (c: number) => {
  const x = Math.max(0, Math.min(1, c));
  return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
};

/** The orbit camera a view uses, at `scale` times the view's pixel size (the rasterizer supersamples). */
export function viewCamera(b: Bounds, o: ViewOpts = {}, scale = 1) {
  const W = (o.w ?? 400) * scale, H = (o.h ?? 400) * scale;
  const fit = o.fit ?? b;
  const center: V3 = scl(add(fit.min, fit.max), 0.5);
  const radius = Math.max(0.01, len(sub(fit.max, fit.min)) / 2);
  const fov = (30 * Math.PI) / 180, dist = (radius / Math.sin(fov / 2)) * 1.08;
  const yaw = ((o.yaw ?? 35) * Math.PI) / 180, pitch = ((o.pitch ?? 25) * Math.PI) / 180;
  const eye: V3 = add(center, [Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist]);
  const fwd = norm(sub(center, eye));
  const right = norm(cross(fwd, Math.abs(fwd[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0]));
  const up = cross(right, fwd);
  const f = (H / 2) / Math.tan(fov / 2);
  const proj = (p: V3): V3 => {
    const d = sub(p, eye), z = dot(d, fwd);
    return [W / 2 + (dot(d, right) / z) * f, H / 2 - (dot(d, up) / z) * f, z];
  };
  /** The ray through pixel (x, y) of the view. */
  const ray = (x: number, y: number): V3 => norm(add(fwd, add(scl(right, (x - W / 2) / f), scl(up, -(y - H / 2) / f))));
  return { W, H, center, radius, eye, fwd, right, up, f, proj, ray };
}

export interface Pick { face: number; point: V3; normal: V3; mat: string; part?: string }

/** The nearest face under pixel (x, y) of a view (in view pixels), or undefined for background. */
export function pick(faces: Face[], b: Bounds, o: ViewOpts, x: number, y: number): Pick | undefined {
  const cam = viewCamera(b, o), dir = cam.ray(x, y);
  let best: Pick | undefined, bt = Infinity;
  faces.forEach((fc, i) => {
    const n = faceNormal(fc.v);
    for (let k = 1; k + 1 < fc.v.length; k++) {                  // faces are convex: a fan covers them
      const a = fc.v[0], e1 = sub(fc.v[k], a), e2 = sub(fc.v[k + 1], a), pv = cross(dir, e2), det = dot(e1, pv);
      if (Math.abs(det) < 1e-12) continue;
      const tv = sub(cam.eye, a), u = dot(tv, pv) / det;
      if (u < 0 || u > 1) continue;
      const qv = cross(tv, e1), v = dot(dir, qv) / det;
      if (v < 0 || u + v > 1) continue;
      const t = dot(e2, qv) / det;
      if (t > 1e-6 && t < bt) { bt = t; best = { face: i, point: add(cam.eye, scl(dir, t)), normal: n, mat: fc.mat, part: fc.part }; }
    }
  });
  return best;
}

export function renderView(faces: Face[], pal: Palette, b: Bounds, o: ViewOpts = {}): Uint8Array {
  const S = 2, { W, H, center, radius, eye, proj, fwd, right, up, f } = viewCamera(b, o, S);

  const lights = o.lights ?? [], night = o.mood ? o.mood === "night" : lights.length > 0;
  const img = new Float32Array(W * H * 3), zb = new Float32Array(W * H).fill(Infinity), ground = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; img[i] = 0.018 + 0.02 * (1 - t); img[i + 1] = 0.02 + 0.022 * (1 - t); img[i + 2] = 0.03 + 0.03 * (1 - t); }
  }

  const raster = (a: V3, bb: V3, c: V3, plot: (i: number, z: number, w0: number, w1: number, w2: number) => void) => {
    if (a[2] <= 1e-6 || bb[2] <= 1e-6 || c[2] <= 1e-6) return;
    const area = (bb[0] - a[0]) * (c[1] - a[1]) - (bb[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) return;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], bb[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], bb[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], bb[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], bb[1], c[1])));
    const ia = 1 / a[2], ib = 1 / bb[2], ic = 1 / c[2];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((bb[0] - px) * (c[1] - py) - (bb[1] - py) * (c[0] - px)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        plot(y * W + x, 1 / (w0 * ia + w1 * ib + w2 * ic), w0, w1, w2);
      }
  };

  // Ground: checker tiles at grid spacing, fading out with distance.
  const gy = b.min[1];
  if (o.ground !== false) {
    const step = gridStep(radius), ext = Math.ceil((radius * 2.2) / step) * step;
    for (let gx = -ext; gx < ext; gx += step)
      for (let gz = -ext; gz < ext; gz += step) {
        const cx = Math.round((center[0] + gx) / step) * step, cz = Math.round((center[2] + gz) / step) * step;
        const q: V3[] = [[cx, gy, cz], [cx + step, gy, cz], [cx + step, gy, cz + step], [cx, gy, cz + step]].map((p) => proj(p as V3)) as V3[];
        const fade = Math.max(0, 1 - Math.hypot(cx + step / 2 - center[0], cz + step / 2 - center[2]) / (ext * 0.95));
        let shade = ((Math.round(cx / step) + Math.round(cz / step)) & 1 ? 0.055 : 0.075) * fade + 0.025 * (1 - fade);
        if (night) shade = shade * 0.35 + punctual(lights, [cx + step / 2, gy, cz + step / 2], [0, 1, 0])[0] * 0.12;
        for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]])
          raster(q[i0], q[i1], q[i2], (i, z) => {
            if (z >= zb[i]) return;
            zb[i] = z; ground[i] = 1;
            img[i * 3] = shade * 0.92; img[i * 3 + 1] = shade * 0.95; img[i * 3 + 2] = shade * 1.08;
          });
      }
  }

  const tris = smoothNormals(faces);
  // Cast shadow: every triangle projected onto the ground along the light, darkening ground pixels once.
  if (o.ground !== false) {
    const shadowed = new Uint8Array(W * H);
    for (const t of tris) {
      const s = t.v.map((p) => proj([p[0] - (LIGHT[0] * (p[1] - gy)) / LIGHT[1], gy, p[2] - (LIGHT[2] * (p[1] - gy)) / LIGHT[1]]));
      raster(s[0], s[1], s[2], (i) => {
        if (!ground[i] || shadowed[i]) return;
        shadowed[i] = 1;
        img[i * 3] *= 0.45; img[i * 3 + 1] *= 0.45; img[i * 3 + 2] *= 0.5;
      });
    }
  }

  const lin = new Map<string, { c: [number, number, number]; e?: [number, number, number]; metal: number; tex?: import("./palette.ts").TexRef }>();
  for (const t of tris) {
    let m = lin.get(t.mat);
    if (!m) {
      const mm = pal.get(t.mat);
      m = { c: srgbToLinear(mm.color), e: mm.emit ? (srgbToLinear(mm.emit).map((x) => x * Math.min(1, (mm.glow ?? 3) / 3)) as [number, number, number]) : undefined, metal: mm.tex ? mm.metal * 0.5 : mm.metal, tex: mm.tex?.albedo ? mm.tex : undefined };
      lin.set(t.mat, m);
    }
    const n = faceNormal(t.v);
    const p = t.v.map(proj);
    // Two-sided: flip normals that face away from the camera (open shapes, inner faces).
    const c0 = t.v[0];
    const nn = dot(n, sub(eye, c0)) < 0 ? scl(n, -1) : n;
    const shadeN = (nn: V3): V3 => {
      const key = Math.max(0, dot(nn, LIGHT)), fill = Math.max(0, dot(nn, FILL));
      const sky = 0.5 + 0.5 * nn[1];
      const lightAmt = night ? 0.05 * sky + 0.02 + 0.1 * key : 0.25 * sky + 0.07 * (1 - sky) + 0.95 * key + 0.22 * fill;
      const spec = m!.metal > 0 && !night ? m!.metal * 0.6 * Math.max(0, dot(nn, norm(add(LIGHT, norm(sub(eye, c0)))))) ** 24 : 0;
      const pl: V3 = lights.length ? punctual(lights, scl(add(add(t.v[0], t.v[1]), t.v[2]), 1 / 3), nn) : [0, 0, 0];
      return m!.c.map((v, k) => v * (lightAmt + pl[k]) * (1 - m!.metal * 0.4) + spec + (m!.e ? m!.e[k] * (night ? 1.4 : 1) : 0)) as V3;
    };
    const colF = shadeN(nn);
    // Smooth faces: light each corner with its own normal (flipped like the face), interpolate (Gouraud).
    let vc = t.n ? t.n.map((cn) => shadeN(dot(n, nn) < 0 ? scl(cn, -1) : cn)) : undefined;
    if (t.c) vc = (vc ?? [colF, colF, colF]).map((cc, k) => scl(cc, t.c![k]));
    const tx = m.tex, al = tx?.albedo;
    raster(p[0], p[1], p[2], (i, z, w0, w1, w2) => {
      if (z >= zb[i]) return;
      zb[i] = z;
      const col = vc ? ([0, 1, 2].map((k) => vc[0][k] * w0 + vc[1][k] * w1 + vc[2][k] * w2) as V3) : colF;
      if (al && tx) {
        // back from the pixel and its depth to the surface point, then the box-projected texel
        const px = (i % W) + 0.5, py = Math.floor(i / W) + 0.5, a = ((px - W / 2) * z) / f, bb = (-(py - H / 2) * z) / f;
        const wp: V3 = [eye[0] + right[0] * a + up[0] * bb + fwd[0] * z, eye[1] + right[1] * a + up[1] * bb + fwd[1] * z, eye[2] + right[2] * a + up[2] * bb + fwd[2] * z];
        const [u, v] = boxUV(wp, n, tx.uv), N = al.n;
        const xi = ((Math.floor(u * N) % N) + N) % N, yi = ((Math.floor(v * N) % N) + N) % N, k = (yi * N + xi) * 3;
        const em = tx.emissive, g = night ? 2.2 : 1.2;
        img[i * 3] = col[0] * al.data[k] + (em ? em.data[k] * g : 0); img[i * 3 + 1] = col[1] * al.data[k + 1] + (em ? em.data[k + 1] * g : 0); img[i * 3 + 2] = col[2] * al.data[k + 2] + (em ? em.data[k + 2] * g : 0);
      } else { img[i * 3] = col[0]; img[i * 3 + 1] = col[1]; img[i * 3 + 2] = col[2]; }
    });
  }

  // Downsample 2x2 -> 1, linear -> sRGB.
  const w = W / S, h = H / S, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bl = 0;
      for (let dy = 0; dy < S; dy++)
        for (let dx = 0; dx < S; dx++) { const i = ((y * S + dy) * W + x * S + dx) * 3; r += img[i]; g += img[i + 1]; bl += img[i + 2]; }
      const o4 = (y * w + x) * 4, k = 1 / (S * S);
      out[o4] = toSrgb(r * k); out[o4 + 1] = toSrgb(g * k); out[o4 + 2] = toSrgb(bl * k); out[o4 + 3] = 255;
    }
  return out;
}
