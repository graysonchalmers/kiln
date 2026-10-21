// Loom materials as kiln textures: find each `tex` folder's manifest, keep the PNG bytes for the
// GLB and decode the albedo for the preview rasterizer. Shared by every palette that copies the mat.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { KilnError } from "../core/errors.ts";
import type { TexRef } from "../core/palette.ts";
import type { Project } from "../core/project.ts";

/** 8-bit RGB / RGBA PNG -> linear RGB floats (enough for loom's albedo maps). */
export function decodePng(buf: Uint8Array): { n: number; w: number; h: number; data: Float32Array } {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 8, w = 0, h = 0, depth = 0, type = 0;
  const idat: Uint8Array[] = [];
  while (o < buf.length) {
    const len = v.getUint32(o), kind = String.fromCharCode(...buf.subarray(o + 4, o + 8)), data = buf.subarray(o + 8, o + 8 + len);
    if (kind === "IHDR") { w = v.getUint32(o + 8); h = v.getUint32(o + 12); depth = buf[o + 16]; type = buf[o + 17]; }
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    o += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6)) throw new KilnError(`texture PNG must be 8-bit RGB or RGBA (got depth ${depth}, type ${type})`);
  const bpp = type === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), row = w * bpp, px = new Uint8Array(h * row);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)], src = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1)), cur = px.subarray(y * row, (y + 1) * row), up = y ? px.subarray((y - 1) * row, y * row) : undefined;
    for (let i = 0; i < row; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = up ? up[i] : 0, c = up && i >= bpp ? up[i - bpp] : 0;
      const pr = () => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
      cur[i] = (src[i] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? pr() : 0)) & 255;
    }
  }
  const lin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const data = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) for (let k = 0; k < 3; k++) data[i * 3 + k] = lin[px[i * bpp + k]];
  return { n: w, w, h, data };
}

/** Resolve every `tex` in the project's palettes, relative to `baseDir`. */
export function resolveTextures(p: Project, baseDir: string): void {
  const seen = new Map<string, Pick<TexRef, "name" | "bytes" | "albedo" | "emissive">>();
  for (const def of p.models.values()) {
    for (const [key, mat] of def.pal.mats) {
      const t = mat.tex;
      if (!t || t.bytes) continue;
      let path = resolve(baseDir, t.src);
      const hit = seen.get(path);
      if (hit) { Object.assign(t, hit); continue; }
      if (!existsSync(path)) throw new KilnError(`material '${key}': no loom material at '${t.src}' (build it with loom first; resolved to ${path})`, def.loc);
      let manifest = path;
      if (statSync(path).isDirectory()) {
        const want = join(path, `${basename(path)}.material.json`);
        manifest = existsSync(want) ? want : join(path, readdirSync(path).find((f) => f.endsWith(".material.json")) ?? "");
        if (!manifest.endsWith(".material.json") || !existsSync(manifest)) throw new KilnError(`material '${key}': '${t.src}' has no .material.json (is it a loom output folder?)`, def.loc);
      }
      const m = JSON.parse(readFileSync(manifest, "utf8")), dir = dirname(manifest);
      const read = (f: string | null) => (f ? new Uint8Array(readFileSync(join(dir, f))) : undefined);
      if (m.normal === "dx") throw new KilnError(`material '${key}': loom material '${m.name}' uses DirectX normals; glTF needs "gl"`, def.loc);
      const bytes = { albedo: read(m.maps.albedo)!, normal: read(m.maps.normal)!, orm: read(m.maps.orm)!, emissive: read(m.maps.emissive) };
      const res = { name: String(m.name), bytes, albedo: decodePng(bytes.albedo), emissive: bytes.emissive ? decodePng(bytes.emissive) : undefined };
      seen.set(path, res);
      Object.assign(t, res);
    }
  }
}
