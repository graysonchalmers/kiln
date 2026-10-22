// Loom materials as kiln textures: find each `tex` folder's manifest, keep the PNG bytes for the
// GLB and decode the albedo for the preview rasterizer. Shared by every palette that copies the mat.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { KilnError } from "../core/errors.ts";
import type { TexRef } from "../core/palette.ts";
import type { Project, Rgba } from "../core/project.ts";

/** PNG bytes -> 8-bit straight RGBA (gray, RGB, palette, alpha; 1..16-bit depths, no interlace), plus the first channel at 16 bits when the file has it. */
export function decodeRgba(buf: Uint8Array): Rgba {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 8 || v.getUint32(0) !== 0x89504e47) throw new KilnError("not a PNG file (kiln reads PNG images)");
  let o = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, plte: Uint8Array | undefined, trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  while (o + 8 <= buf.length) {
    const len = v.getUint32(o), kind = String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]), data = buf.subarray(o + 8, o + 8 + len);
    if (kind === "IHDR") { w = v.getUint32(o + 8); h = v.getUint32(o + 12); depth = buf[o + 16]; type = buf[o + 17]; interlace = buf[o + 20]; }
    else if (kind === "PLTE") plte = data;
    else if (kind === "tRNS") trns = data;
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    o += 12 + len;
  }
  if (!w || !h) throw new KilnError("PNG has no IHDR");
  if (interlace) throw new KilnError("interlaced PNGs aren't supported: re-save the image without interlacing");
  const chans = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!chans || ![1, 2, 4, 8, 16].includes(depth)) throw new KilnError(`unsupported PNG (color type ${type}, depth ${depth})`);
  const bits = chans * depth, bpp = Math.max(1, Math.ceil(bits / 8)), row = Math.ceil((w * bits) / 8);
  const raw = inflateSync(Buffer.concat(idat.map((d) => Buffer.from(d.buffer, d.byteOffset, d.byteLength))));
  if (raw.length < h * (row + 1)) throw new KilnError("PNG data is truncated");
  const px = new Uint8Array(h * row);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)], src = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1)), cur = px.subarray(y * row, (y + 1) * row), up = y ? px.subarray((y - 1) * row, y * row) : undefined;
    for (let i = 0; i < row; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = up ? up[i] : 0, c = up && i >= bpp ? up[i - bpp] : 0;
      const pr = () => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
      cur[i] = (src[i] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? pr() : 0)) & 255;
    }
  }
  const max = (1 << depth) - 1, scale = depth < 8 ? 255 / max : 1;
  const sample = (line: Uint8Array, x: number, k: number): number => {
    const s = x * chans + k;
    if (depth === 8) return line[s];
    if (depth === 16) return line[s * 2];
    const bit = s * depth;
    return (line[bit >> 3] >> (8 - depth - (bit & 7))) & max;
  };
  const rgba = new Uint8Array(w * h * 4), hi = depth === 16 ? new Uint16Array(w * h) : undefined;
  for (let y = 0; y < h; y++) {
    const line = px.subarray(y * row, (y + 1) * row);
    for (let x = 0; x < w; x++) {
      const d = (y * w + x) * 4;
      let r: number, g: number, b: number, a = 255;
      if (type === 3) {
        const i = sample(line, x, 0);
        if (!plte || i * 3 + 2 >= plte.length) throw new KilnError("PNG palette index out of range");
        r = plte[i * 3]; g = plte[i * 3 + 1]; b = plte[i * 3 + 2];
        if (trns && i < trns.length) a = trns[i];
      } else if (type === 0 || type === 4) {
        r = g = b = Math.round(sample(line, x, 0) * scale);
        if (type === 4) a = Math.round(sample(line, x, 1) * scale);
      } else {
        r = Math.round(sample(line, x, 0) * scale); g = Math.round(sample(line, x, 1) * scale); b = Math.round(sample(line, x, 2) * scale);
        if (type === 6) a = Math.round(sample(line, x, 3) * scale);
      }
      rgba[d] = r; rgba[d + 1] = g; rgba[d + 2] = b; rgba[d + 3] = a;
      if (hi) hi[y * w + x] = (line[(x * chans) * 2] << 8) | line[(x * chans) * 2 + 1];
    }
  }
  return { w, h, rgba, hi };
}

/** PNG -> linear RGB floats (loom's albedo and emissive maps). */
export function decodePng(buf: Uint8Array): { n: number; w: number; h: number; data: Float32Array } {
  const { w, h, rgba } = decodeRgba(buf);
  const lin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const data = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) for (let k = 0; k < 3; k++) data[i * 3 + k] = lin[rgba[i * 4 + k]];
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
