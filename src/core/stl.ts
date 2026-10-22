// Binary STL writer: every face triangulated, normals from the geometry. For 3D printing and
// CAD tools, which read STL before anything else (no materials, no color).
import { type Face, faceNormal, triangulate } from "./mesh.ts";

export function stl(faces: Face[], name = "kiln"): Uint8Array {
  const tris = triangulate(faces);
  const out = new Uint8Array(84 + tris.length * 50), v = new DataView(out.buffer);
  const header = new TextEncoder().encode(`kiln ${name}`.slice(0, 80));
  out.set(header, 0);
  v.setUint32(80, tris.length, true);
  let o = 84;
  for (const t of tris) {
    const n = faceNormal(t.v);
    for (const p of [n, ...t.v]) for (let k = 0; k < 3; k++) { v.setFloat32(o, p[k], true); o += 4; }
    o += 2; // attribute byte count
  }
  return out;
}
