// Voxel grids and greedy meshing: only faces between a solid voxel and empty space are kept, and
// coplanar faces of the same material merge into rectangles, so voxel models stay light.
import { KilnError } from "./errors.ts";
import { type Face, orient } from "./mesh.ts";
import type { V3 } from "./util.ts";

export interface Grid {
  nx: number;
  ny: number;
  nz: number;
  /** Material key per voxel, null = empty; index x + nx * (z + nz * y). */
  cells: (string | null)[];
}

/**
 * Layers bottom to top. In each layer, rows run from the back (-z) to the front (+z) and columns
 * from left (-x) to right (+x): read it as a top-down map. "." or space = empty; any other
 * character is a single-character palette key. Indentation and blank edge rows are ignored.
 */
export function parseLayers(layers: unknown[], isKey: (k: string) => boolean): Grid {
  if (!layers.length) throw new KilnError("voxels needs at least one layer string");
  const parsed = layers.map((l, i) => {
    if (typeof l !== "string") throw new KilnError(`layer ${i + 1} must be a string (use a template literal)`);
    const rows = l.split("\n").map((r) => r.trim());
    while (rows.length && !rows[0]) rows.shift();
    while (rows.length && !rows[rows.length - 1]) rows.pop();
    return rows;
  });
  const nz = Math.max(...parsed.map((r) => r.length)), nx = Math.max(...parsed.flatMap((r) => r.map((row) => row.length)));
  const grid: Grid = { nx, ny: parsed.length, nz, cells: new Array(nx * nz * parsed.length).fill(null) };
  parsed.forEach((rows, y) => rows.forEach((row, z) => [...row].forEach((ch, x) => {
    if (ch === "." || ch === " ") return;
    if (!isKey(ch)) throw new KilnError(`layer ${y + 1}, row ${z + 1}, column ${x + 1}: '${ch}' is not a palette key`);
    grid.cells[x + nx * (z + nz * y)] = ch;
  })));
  return grid;
}

export function gridFn(size: V3, fn: (x: number, y: number, z: number) => unknown, isKey: (k: string) => boolean): Grid {
  const [nx, ny, nz] = size.map(Math.floor);
  if (!(nx > 0 && ny > 0 && nz > 0) || nx * ny * nz > 4_000_000) throw new KilnError("voxfn size must be [nx, ny, nz] with at most 4M voxels");
  const grid: Grid = { nx, ny, nz, cells: new Array(nx * ny * nz).fill(null) };
  for (let y = 0; y < ny; y++)
    for (let z = 0; z < nz; z++)
      for (let x = 0; x < nx; x++) {
        const k = fn(x, y, z);
        if (k === null || k === undefined || k === false || k === ".") continue;
        if (typeof k !== "string" || !isKey(k)) throw new KilnError(`voxfn returned ${JSON.stringify(k)} at ${x},${y},${z}: return a palette key or null`);
        grid.cells[x + nx * (z + nz * y)] = k;
      }
  return grid;
}

/** Greedy-meshed faces; voxel size `s`, centered in x/z, bottom at y = 0. */
export function meshGrid(g: Grid, s: number): Face[] {
  const dims = [g.nx, g.ny, g.nz];
  const at = (p: number[]) => (p[0] < 0 || p[1] < 0 || p[2] < 0 || p[0] >= g.nx || p[1] >= g.ny || p[2] >= g.nz ? null : g.cells[p[0] + g.nx * (p[2] + g.nz * p[1])]);
  const off = [-g.nx / 2, 0, -g.nz / 2];
  const faces: Face[] = [];
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3;
    const mask: (string | null)[] = new Array(dims[u] * dims[v]);
    const x = [0, 0, 0], q = [0, 0, 0];
    q[d] = 1;
    for (x[d] = -1; x[d] < dims[d];) {
      // mask entries: "+key" face toward +d, "-key" toward -d
      let n = 0;
      for (x[v] = 0; x[v] < dims[v]; x[v]++)
        for (x[u] = 0; x[u] < dims[u]; x[u]++) {
          const a = at(x), b = at([x[0] + q[0], x[1] + q[1], x[2] + q[2]]);
          mask[n++] = a && !b ? "+" + a : b && !a ? "-" + b : null;
        }
      x[d]++;
      n = 0;
      for (let j = 0; j < dims[v]; j++)
        for (let i = 0; i < dims[u];) {
          const m = mask[n];
          if (!m) { i++; n++; continue; }
          let w = 1;
          while (i + w < dims[u] && mask[n + w] === m) w++;
          let h = 1;
          grow: for (; j + h < dims[v]; h++)
            for (let k = 0; k < w; k++) if (mask[n + k + h * dims[u]] !== m) break grow;
          const base = [0, 0, 0], du = [0, 0, 0], dv = [0, 0, 0];
          base[d] = x[d]; base[u] = i; base[v] = j;
          du[u] = w; dv[v] = h;
          const P = (p: number[]): V3 => [(p[0] + off[0]) * s, (p[1] + off[1]) * s, (p[2] + off[2]) * s];
          const c0 = base, c1 = [base[0] + du[0], base[1] + du[1], base[2] + du[2]];
          const c2 = [c1[0] + dv[0], c1[1] + dv[1], c1[2] + dv[2]], c3 = [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]];
          const nrm: V3 = [0, 0, 0];
          nrm[d] = m[0] === "+" ? 1 : -1;
          faces.push({ v: orient([P(c0), P(c1), P(c2), P(c3)], nrm), mat: m.slice(1) });
          for (let l = 0; l < h; l++) for (let k = 0; k < w; k++) mask[n + k + l * dims[u]] = null;
          i += w; n += w;
        }
    }
  }
  return faces;
}
