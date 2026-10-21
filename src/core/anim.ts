// Keyframed clips for named parts: sampling with easing, validation, and posing a built model.
import { KilnError, didYouMean } from "./errors.ts";
import { type Face, type Joint, type Light, transform, transformLights } from "./mesh.ts";
import { type M, type V3, ID, mul, rotM, scaleM, translate } from "./util.ts";

export const EASES = ["linear", "in", "out", "inOut", "step"] as const;
export type Ease = (typeof EASES)[number];
type Val = number | number[];
export type Key = [number, Val] | [number, Val, Ease];
export interface PartKeys { rot?: Key[]; move?: Key[]; scale?: Key[] }

export interface ClipDef {
  model: string;
  name: string;
  frames: number;
  fps: number;
  tracks: Record<string, PartKeys>;
  loc?: string;
}

const CHANNELS = ["rot", "move", "scale"];

function ease(e: Ease, t: number): number {
  switch (e) {
    case "step": return 0;
    case "in": return t * t;
    case "out": return 1 - (1 - t) * (1 - t);
    case "inOut": return t * t * (3 - 2 * t);
    default: return t;
  }
}

/** Value at frame i; keys hold before the first and after the last. */
export function sample(keys: Key[], i: number): Val {
  if (i <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (i >= last[0]) return last[1];
  let k = 0;
  while (keys[k + 1][0] <= i) k++;
  const [f0, v0, e = "inOut"] = keys[k], [f1, v1] = keys[k + 1];
  const t = ease(e as Ease, (i - f0) / (f1 - f0));
  if (typeof v0 === "number") return v0 + ((v1 as number) - v0) * t;
  return v0.map((a, j) => a + ((v1 as number[])[j] - a) * t);
}

const v3 = (v: Val, what: string): V3 => {
  if (typeof v === "number") return what === "scale" ? [v, v, v] : [0, v, 0];
  return v as V3;
};

export function checkTracks(tracks: unknown, frames: number): Record<string, PartKeys> {
  if (typeof tracks !== "object" || tracks === null || Array.isArray(tracks)) throw new KilnError("tracks are { part: { rot, move, scale }, ... }");
  for (const [part, keys] of Object.entries(tracks)) {
    if (typeof keys !== "object" || keys === null) throw new KilnError(`part '${part}': use { rot, move, scale }`);
    for (const [ch, ks] of Object.entries(keys)) {
      if (!CHANNELS.includes(ch)) throw new KilnError(`part '${part}': unknown channel '${ch}'${didYouMean(ch, CHANNELS)} (rot, move, scale)`);
      if (!Array.isArray(ks) || !ks.length) throw new KilnError(`${part}.${ch}: keys are [[frame, value, ease?], ...]`);
      let prev = -Infinity;
      for (const k of ks) {
        if (!Array.isArray(k) || k.length < 2 || typeof k[0] !== "number") throw new KilnError(`${part}.${ch}: each key is [frame, value] or [frame, value, ease]`);
        if (k[0] <= prev) throw new KilnError(`${part}.${ch}: key frames must increase (${prev} then ${k[0]})`);
        if (k[0] < 0 || k[0] > frames) throw new KilnError(`${part}.${ch}: key at frame ${k[0]} is outside 0..${frames}`);
        prev = k[0];
        if (k[2] !== undefined && !EASES.includes(k[2])) throw new KilnError(`${part}.${ch}: ease '${k[2]}'${didYouMean(String(k[2]), EASES)} (${EASES.join(", ")})`);
        const v = k[1];
        const ok = typeof v === "number" || (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number"));
        if (!ok) throw new KilnError(`${part}.${ch}: value ${JSON.stringify(v)} should be [x, y, z]${ch === "move" ? "" : " or a number"}`);
        if (ch === "move" && typeof v === "number") throw new KilnError(`${part}.move: value must be [dx, dy, dz]`);
      }
    }
  }
  return tracks as Record<string, PartKeys>;
}

/** Local animated values of a part at frame i (rot in degrees). */
export function partValues(k: PartKeys | undefined, i: number): { rot: V3; move: V3; scale: V3 } {
  return {
    rot: k?.rot ? v3(sample(k.rot, i), "rot") : [0, 0, 0],
    move: k?.move ? v3(sample(k.move, i), "move") : [0, 0, 0],
    scale: k?.scale ? v3(sample(k.scale, i), "scale") : [1, 1, 1],
  };
}

/** World matrix of every joint at frame i: parent * T(pivot + move) * R * S * T(-pivot). */
export function jointMatrices(joints: Joint[], tracks: Record<string, PartKeys>, i: number): Map<string, M> {
  const by = new Map(joints.map((j) => [j.name, j])), out = new Map<string, M>();
  const get = (name: string): M => {
    const hit = out.get(name);
    if (hit) return hit;
    const j = by.get(name)!;
    const { rot, move, scale } = partValues(tracks[name], i);
    const local = mul(translate([j.pivot[0] + move[0], j.pivot[1] + move[1], j.pivot[2] + move[2]]), mul(rotM(rot), mul(scaleM(scale), translate([-j.pivot[0], -j.pivot[1], -j.pivot[2]]))));
    const m = j.parent ? mul(get(j.parent), local) : local;
    out.set(name, m);
    return m;
  };
  for (const j of joints) get(j.name);
  return out;
}

export function poseFaces(faces: Face[], lights: Light[], joints: Joint[], tracks: Record<string, PartKeys>, i: number): { faces: Face[]; lights: Light[] } {
  const ms = jointMatrices(joints, tracks, i);
  const groups = new Map<string, Face[]>(), lg = new Map<string, Light[]>();
  for (const f of faces) { const k = f.part ?? ""; (groups.get(k) ?? groups.set(k, []).get(k)!).push(f); }
  for (const l of lights) { const k = l.part ?? ""; (lg.get(k) ?? lg.set(k, []).get(k)!).push(l); }
  const outF: Face[] = [], outL: Light[] = [];
  for (const [k, fs] of groups) outF.push(...transform(fs, k ? ms.get(k) ?? ID : ID));
  for (const [k, ls] of lg) outL.push(...transformLights(ls, k ? ms.get(k) ?? ID : ID));
  return { faces: outF, lights: outL };
}
