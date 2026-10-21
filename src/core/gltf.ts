// glTF 2.0 binary (GLB) writer: one node per model, one primitive per material, flat normals.
import { type Face, type Light, faceNormal, triangulate } from "./mesh.ts";
import { type Palette, srgbToLinear } from "./palette.ts";
import type { V3 } from "./util.ts";

export interface GlbModel {
  name: string;
  faces: Face[];
  pal: Palette;
  lights?: Light[];
  translation?: V3;
}

/** Shortest rotation taking -Z (a glTF light's direction) to `d`, as [x, y, z, w]. */
function quatToDir(d: V3): number[] {
  const a: V3 = [0, 0, -1], c = a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  if (c < -0.999999) return [0, 1, 0, 0];
  const x = a[1] * d[2] - a[2] * d[1], y = a[2] * d[0] - a[0] * d[2], z = a[0] * d[1] - a[1] * d[0], w = 1 + c;
  const l = Math.hypot(x, y, z, w);
  return [x / l, y / l, z / l, w / l];
}

export function glb(models: GlbModel[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const bufferViews: Record<string, unknown>[] = [], accessors: Record<string, unknown>[] = [];
  const push = (data: Float32Array, kind: "VEC3", min?: number[], max?: number[]): number => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target: 34962 });
    chunks.push(bytes);
    byteLength += bytes.length;
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); byteLength += pad; }
    accessors.push({ bufferView: bufferViews.length - 1, componentType: 5126, count: data.length / 3, type: kind, ...(min ? { min, max } : {}) });
    return accessors.length - 1;
  };

  // Materials are shared by key across models (first definition wins).
  const matIndex = new Map<string, number>(), materials: Record<string, unknown>[] = [];
  let emissiveStrength = false;
  const material = (key: string, pal: Palette): number => {
    let i = matIndex.get(key);
    if (i !== undefined) return i;
    const m = pal.get(key);
    const mat: Record<string, unknown> = {
      name: key,
      pbrMetallicRoughness: { baseColorFactor: [...srgbToLinear(m.color), 1], metallicFactor: m.metal, roughnessFactor: m.rough },
    };
    if (m.emit) {
      mat.emissiveFactor = srgbToLinear(m.emit);
      if ((m.glow ?? 1) > 1) { mat.extensions = { KHR_materials_emissive_strength: { emissiveStrength: m.glow } }; emissiveStrength = true; }
    }
    materials.push(mat);
    i = materials.length - 1;
    matIndex.set(key, i);
    return i;
  };

  const meshes: Record<string, unknown>[] = [], nodes: Record<string, unknown>[] = [], roots: number[] = [];
  const lights: Record<string, unknown>[] = [];
  for (const mdl of models) {
    const byMat = new Map<string, Face[]>();
    for (const f of triangulate(mdl.faces)) {
      const l = byMat.get(f.mat) ?? [];
      l.push(f);
      byMat.set(f.mat, l);
    }
    const primitives: Record<string, unknown>[] = [];
    for (const [key, tris] of byMat) {
      const pos = new Float32Array(tris.length * 9), nrm = new Float32Array(tris.length * 9);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      tris.forEach((t, i) => {
        const n = faceNormal(t.v);
        t.v.forEach((p, k) => {
          for (let c = 0; c < 3; c++) {
            pos[i * 9 + k * 3 + c] = p[c];
            nrm[i * 9 + k * 3 + c] = n[c];
            if (p[c] < min[c]) min[c] = p[c];
            if (p[c] > max[c]) max[c] = p[c];
          }
        });
      });
      primitives.push({ attributes: { POSITION: push(pos, "VEC3", min, max), NORMAL: push(nrm, "VEC3") }, material: material(key, mdl.pal), mode: 4 });
    }
    meshes.push({ name: mdl.name, primitives });
    const children: number[] = [];
    for (const [i, l] of (mdl.lights ?? []).entries()) {
      // Watts -> candela, the inverse of Blender's importer, so power survives the round trip.
      const light: Record<string, unknown> = { name: `${mdl.name}_light_${i}`, type: l.type, color: srgbToLinear(l.color), intensity: (l.power * 683) / (4 * Math.PI) };
      if (l.range) light.range = l.range;
      if (l.type === "spot") {
        const outer = (((l.angle ?? 35) * Math.PI) / 180);
        light.spot = { outerConeAngle: Math.min(outer, Math.PI / 2), innerConeAngle: Math.min(outer, Math.PI / 2) * 0.7 };
      }
      lights.push(light);
      nodes.push({ name: light.name, translation: l.pos, rotation: quatToDir(l.dir), extensions: { KHR_lights_punctual: { light: lights.length - 1 } } });
      children.push(nodes.length - 1);
    }
    nodes.push({ name: mdl.name, mesh: meshes.length - 1, ...(children.length ? { children } : {}), ...(mdl.translation ? { translation: mdl.translation } : {}) });
    roots.push(nodes.length - 1);
  }

  const json: Record<string, unknown> = {
    asset: { version: "2.0", generator: "kiln" },
    scene: 0, scenes: [{ nodes: roots }],
    nodes, meshes, materials, accessors, bufferViews, buffers: [{ byteLength }],
  };
  const used = [...(emissiveStrength ? ["KHR_materials_emissive_strength"] : []), ...(lights.length ? ["KHR_lights_punctual"] : [])];
  if (used.length) json.extensionsUsed = used;
  if (lights.length) json.extensions = { KHR_lights_punctual: { lights } };

  const enc = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = Math.ceil(enc.length / 4) * 4;
  const total = 12 + 8 + jsonLen + 8 + byteLength;
  const out = new Uint8Array(total), v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, total, true);
  v.setUint32(12, jsonLen, true); v.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLen);
  out.set(enc, 20);
  let o = 20 + jsonLen;
  v.setUint32(o, byteLength, true); v.setUint32(o + 4, 0x004e4942, true);
  o += 8;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
