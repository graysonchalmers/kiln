// Project: the registry a model file fills in (the DSL), plus the lazy, cached, cycle-checked
// builder that turns definitions into face lists.
import { KilnError, didYouMean, wrap } from "./errors.ts";
import { type Bounds, type Face, type Joint, type Light, type Part, bounds, renameParts, jitter, recolor, transform, transformLights, transformPart, triCount } from "./mesh.ts";
import { Palette, normHex } from "./palette.ts";
import { type ClipDef, checkTracks } from "./anim.ts";
import { box, cyl, extrude, lathe, prism, rock, sphere, wedge } from "./prims.ts";
import { gridFn, meshGrid, parseLayers } from "./voxel.ts";
import { type M, type V3, globRe, hash, mul, rng, rotM, scaleM, translate } from "./util.ts";

export interface Step {
  label: string;
  loc?: string;
}

/** Geometry made at definition time, or a reference resolved at build time. */
interface Geo { __geo: true; faces: Face[]; lights?: Light[]; step: Step }
interface Ref { __ref: "stamp" | "scatter" | "tf" | "sym" | "part"; args: unknown[]; step: Step }
type Item = Geo | Ref | Item[] | null | undefined | false;

export interface ModelOpts {
  pivot?: "bottom" | "center" | "origin";
  base?: string;
  swap?: Record<string, string>;
  scale?: number;
}

export interface ModelDef {
  name: string;
  opts: ModelOpts;
  items: Item[];
  pal: Palette;
  loc?: string;
}

export interface PackDef {
  name: string;
  entries: string[];
  opts: { spacing?: number; cols?: number };
  loc?: string;
}

export interface Built {
  name: string;
  faces: Face[];
  /** Faces after each top-level item (same pivot as the final model), for step replay. */
  steps: { label: string; loc?: string; end: number }[];
  bounds: Bounds;
  tris: number;
  pal: Palette;
  lights: Light[];
  /** Animatable parts (named nodes with pivots). */
  joints: Joint[];
}

const MODEL_OPTS = ["pivot", "base", "swap", "scale"];
const PLACE = ["pos", "rot", "scale"];
const SHAPE_OPTS: Record<string, string[]> = {
  box: [], cyl: ["sides", "top"], cone: ["sides"], sphere: ["detail"], rock: ["detail", "rough", "squash", "seed"],
  lathe: ["sides"], extrude: [], prism: [], wedge: [], voxels: ["size"], voxfn: ["size"],
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isGeo = (v: unknown): v is Geo => isObj(v) && "__geo" in v;
const isRef = (v: unknown): v is Ref => isObj(v) && "__ref" in v;
const isPlain = (v: unknown): v is Record<string, unknown> => isObj(v) && !isGeo(v) && !isRef(v);

function checkKeys(what: string, obj: object, allowed: string[]): void {
  for (const k of Object.keys(obj))
    if (!allowed.includes(k)) throw new KilnError(`${what}: unknown option '${k}'${didYouMean(k, allowed)} (allowed: ${allowed.join(", ")})`);
}

function vec(v: unknown, what: string, dflt: V3): V3 {
  if (v === undefined) return dflt;
  if (typeof v === "number") return [v, v, v];
  if (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x))) return v as V3;
  throw new KilnError(`${what} must be [x, y, z]${what === "scale" ? " or a number" : ""}`);
}

/** pos / rot / scale -> matrix (scale, then rotate, then move). */
function placeM(o: Record<string, unknown>): M {
  return mul(translate(vec(o.pos, "pos", [0, 0, 0])), mul(rotM(vec(o.rot, "rot", [0, 0, 0])), scaleM(vec(o.scale, "scale", [1, 1, 1]))));
}

const num = (v: unknown, what: string, min = 0): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) throw new KilnError(`${what} must be a number${min > 0 ? " > 0" : ""}`);
  return v;
};
const fmt = (v: unknown) => (typeof v === "number" ? String(Math.round(v * 100) / 100) : Array.isArray(v) ? `[${v.length}]` : String(v));

export class Project {
  readonly models = new Map<string, ModelDef>();
  readonly order: string[] = [];
  readonly groups = new Map<string, { name: string; members: string[]; loc?: string }>();
  readonly packs: PackDef[] = [];
  readonly clips: ClipDef[] = [];
  readonly files: string[] = [];
  pal = Palette.default();
  includeHook?: (path: string) => void;

  private cache = new Map<string, Built>();
  private building = new Set<string>();

  addFile(file: string): void {
    if (!this.files.includes(file)) this.files.push(file);
  }

  locFromStack(stack: string): string | undefined {
    for (const line of stack.split("\n"))
      for (const f of this.files) {
        const i = line.indexOf(f + ":");
        if (i < 0) continue;
        const m = /^:(\d+):(\d+)/.exec(line.slice(i + f.length));
        if (m) return `${f.replace(/^.*[\\/]/, "")}:${m[1]}:${m[2]}`;
      }
    return undefined;
  }

  callerLoc(): string | undefined {
    const limit = Error.stackTraceLimit;
    Error.stackTraceLimit = 60;
    const stack = new Error().stack ?? "";
    Error.stackTraceLimit = limit;
    return this.locFromStack(stack);
  }

  // ---------------------------------------------------------------- DSL

  env(): Record<string, unknown> {
    const env: Record<string, unknown> = {};
    const at = <T>(what: string, fn: (loc?: string) => T): T => {
      const loc = this.callerLoc();
      try { return fn(loc); } catch (e) { throw wrap(e).within(what, loc); }
    };
    const mat = (k: unknown) => {
      if (typeof k !== "string") throw new KilnError(`material must be a palette key string, got ${JSON.stringify(k) ?? typeof k}`);
      this.pal.get(k);
      return k;
    };
    /** Last argument: a material key or { mat, pos, rot, scale, jitter, seed, ...shape options }. */
    const style = (kind: string, v: unknown): { mat: string; o: Record<string, unknown> } => {
      if (typeof v === "string") return { mat: mat(v), o: {} };
      if (!isPlain(v)) throw new KilnError(`needs a material: "${[...this.pal.mats.keys()][0]}" or { mat, pos, rot, scale, ... }`);
      checkKeys("options", v, ["mat", ...PLACE, "jitter", "seed", ...SHAPE_OPTS[kind].filter((k) => k !== "seed")]);
      if (v.mat === undefined && !["voxels", "voxfn"].includes(kind)) throw new KilnError(`${kind} needs { mat: "key" }`);
      return { mat: v.mat === undefined ? "" : mat(v.mat), o: v };
    };
    const geo = (kind: string, args: unknown[], make: (mat: string, o: Record<string, unknown>) => Face[]): Geo => at(kind, (loc) => {
      const { mat: m, o } = style(kind, args[args.length - 1]);
      let faces = transform(make(m, o), placeM(o));
      if (o.jitter !== undefined) faces = jitter(faces, num(o.jitter, "jitter"), Number(o.seed ?? hash(`${kind}|${loc}`)));
      return { __geo: true, faces, step: { label: `${kind}(${args.slice(0, -1).map(fmt).join(", ")})`, loc } };
    });

    env.pal = (defs: unknown) => at("pal", () => {
      if (!isObj(defs)) throw new KilnError('pal({ wood: "#8a5a3c", lamp: { color: "#ffd28a", emit: "#ffb040" } })');
      this.pal = this.pal.extend(defs);
    });
    env.model = (name: unknown, ...rest: unknown[]) => at("model", (loc) => {
      if (typeof name !== "string" || !name) throw new KilnError("model needs a name string first");
      const prev = this.models.get(name) ?? this.groups.get(name);
      if (prev) throw new KilnError(`'${name}' is already defined at ${prev.loc}`);
      const opts = (isPlain(rest[0]) ? rest.shift() : {}) as ModelOpts;
      checkKeys(`model '${name}'`, opts, MODEL_OPTS);
      if (opts.pivot !== undefined && !["bottom", "center", "origin"].includes(opts.pivot)) throw new KilnError('pivot must be "bottom", "center" or "origin"');
      for (const [k, v] of Object.entries(opts.swap ?? {})) { mat(k); mat(v); }
      this.models.set(name, { name, opts, items: rest as Item[], pal: this.pal, loc });
      this.order.push(name);
    });

    env.box = (w: unknown, h: unknown, d: unknown, s: unknown) => geo("box", [w, h, d, s], (m) => box(num(w, "w", 1e-9), num(h, "h", 1e-9), num(d, "d", 1e-9), m));
    env.cyl = (r: unknown, h: unknown, s: unknown) => geo("cyl", [r, h, s], (m, o) => cyl(num(r, "r", 1e-9), num(h, "h", 1e-9), Number(o.sides ?? 8), Number(o.top ?? r), m));
    env.cone = (r: unknown, h: unknown, s: unknown) => geo("cone", [r, h, s], (m, o) => cyl(num(r, "r", 1e-9), num(h, "h", 1e-9), Number(o.sides ?? 8), 0, m));
    env.sphere = (r: unknown, s: unknown) => geo("sphere", [r, s], (m, o) => sphere(num(r, "r", 1e-9), Number(o.detail ?? 1), m));
    env.rock = (r: unknown, s: unknown) => geo("rock", [r, s], (m, o) =>
      rock(num(r, "r", 1e-9), Number(o.detail ?? 1), Number(o.rough ?? 0.22), Number(o.squash ?? 0.75), Number(o.seed ?? 1), m));
    env.lathe = (prof: unknown, s: unknown) => geo("lathe", [prof, s], (m, o) => {
      if (!Array.isArray(prof) || prof.length % 2) throw new KilnError("lathe profile: flat list [r0, y0, r1, y1, ...] from bottom to top");
      const pts: [number, number][] = [];
      for (let i = 0; i < prof.length; i += 2) pts.push([num(prof[i], "radius"), num(prof[i + 1], "y", -Infinity)]);
      return lathe(pts, Number(o.sides ?? 8), m);
    });
    env.extrude = (pts: unknown, depth: unknown, s: unknown) => geo("extrude", [pts, depth, s], (m) => {
      if (!Array.isArray(pts) || pts.length % 2 || pts.length < 6) throw new KilnError("extrude outline: flat list [x0, y0, x1, y1, ...] (at least 3 points)");
      const p: [number, number][] = [];
      for (let i = 0; i < pts.length; i += 2) p.push([num(pts[i], "x", -Infinity), num(pts[i + 1], "y", -Infinity)]);
      return extrude(p, num(depth, "depth", 1e-9), m);
    });
    env.prism = (w: unknown, h: unknown, d: unknown, s: unknown) => geo("prism", [w, h, d, s], (m) => prism(num(w, "w", 1e-9), num(h, "h", 1e-9), num(d, "d", 1e-9), m));
    env.wedge = (w: unknown, h: unknown, d: unknown, s: unknown) => geo("wedge", [w, h, d, s], (m) => wedge(num(w, "w", 1e-9), num(h, "h", 1e-9), num(d, "d", 1e-9), m));
    const isKey = (k: string) => this.pal.has(k);
    env.voxels = (layers: unknown, s: unknown = {}) => geo("voxels", [layers, s], (_m, o) => {
      if (!Array.isArray(layers)) throw new KilnError("voxels([layer, layer, ...]): one string per layer, bottom to top");
      return meshGrid(parseLayers(layers, isKey), Number(o.size ?? 1));
    });
    env.voxfn = (size: unknown, fn: unknown, s: unknown = {}) => geo("voxfn", [size, fn, s], (_m, o) => {
      if (typeof fn !== "function") throw new KilnError("voxfn([nx, ny, nz], (x, y, z) => key | null, { size })");
      return meshGrid(gridFn(vec(size, "size", [1, 1, 1]), fn as (x: number, y: number, z: number) => unknown, isKey), Number(o.size ?? 1));
    });

    const ref = (kind: Ref["__ref"], args: unknown[], label: string) => at(kind, (loc): Ref => ({ __ref: kind, args, step: { label, loc } }));
    env.light = (o: unknown = {}) => at("light", (loc): Geo => {
      if (!isPlain(o)) throw new KilnError('light({ type: "point" | "spot", color, power, pos, dir, angle, range })');
      checkKeys("light", o, ["type", "color", "power", "pos", "dir", "angle", "range"]);
      const type = o.type ?? "point";
      if (type !== "point" && type !== "spot") throw new KilnError('light type must be "point" or "spot"');
      const color = typeof o.color === "string" ? normHex(o.color) : "#ffffff";
      const power = o.power === undefined ? 20 : num(o.power, "power");
      const d = vec(o.dir, "dir", [0, -1, 0]), dl = Math.hypot(...d) || 1;
      const l: Light = { type, color, power, pos: vec(o.pos, "pos", [0, 0, 0]), dir: [d[0] / dl, d[1] / dl, d[2] / dl] };
      if (o.angle !== undefined) l.angle = num(o.angle, "angle");
      if (o.range !== undefined) l.range = num(o.range, "range");
      return { __geo: true, faces: [], lights: [l], step: { label: `light(${type} ${color} ${power}W)`, loc } };
    });
    env.part = (name: unknown, o: unknown, ...items: unknown[]) => at("part", () => {
      if (typeof name !== "string" || !/^[A-Za-z0-9_.~-]+$/.test(name)) throw new KilnError('part("name", { pivot: [x, y, z], parent? }, ...items): names use letters, digits, _ . ~ -');
      if (!isPlain(o)) throw new KilnError(`part '${name}' needs { pivot: [x, y, z] }`);
      checkKeys(`part '${name}'`, o, ["pivot", "parent"]);
      vec(o.pivot, "pivot", [0, 0, 0]);
      if (o.pivot === undefined) throw new KilnError(`part '${name}' needs { pivot: [x, y, z] }: the point it rotates about`);
      if (o.parent !== undefined && typeof o.parent !== "string") throw new KilnError(`part '${name}': parent must be a part name`);
      return ref("part", [name, o, ...items], `part("${name}")`);
    });
    env.animate = (model: unknown, name: unknown, o: unknown, tracks: unknown) => at("animate", (loc) => {
      if (typeof model !== "string" || typeof name !== "string" || !isPlain(o)) throw new KilnError('animate("model", "clip", { frames, fps }, { part: { rot, move, scale } })');
      checkKeys("animate", o, ["frames", "fps"]);
      const frames = num(o.frames, "frames", 1), fps = o.fps === undefined ? 24 : num(o.fps, "fps", 1);
      if (this.clips.some((c) => c.model === model && c.name === name)) throw new KilnError(`model '${model}' already has a clip '${name}'`);
      this.clips.push({ model, name, frames, fps, tracks: checkTracks(tracks, frames), loc });
    });
    env.tf = (o: unknown, ...items: unknown[]) => at("tf", () => {
      if (!isPlain(o)) throw new KilnError("tf({ pos, rot, scale }, ...items)");
      checkKeys("tf", o, PLACE);
      placeM(o);
      return ref("tf", [o, ...items], `tf(${Object.keys(o).join(", ")})`);
    });
    env.sym = (axis: unknown, ...items: unknown[]) => at("sym", () => {
      if (axis !== "x" && axis !== "z") throw new KilnError('sym("x" | "z", ...items): items plus their mirror image across x = 0 (or z = 0)');
      return ref("sym", [axis, ...items], `sym("${axis}")`);
    });
    env.stamp = (name: unknown, o: unknown = {}) => at("stamp", () => {
      if (typeof name !== "string" || !isPlain(o)) throw new KilnError('stamp("name", { pos, rot, scale, swap })');
      checkKeys("stamp", o, [...PLACE, "swap", "as"]);
      if (o.as !== undefined && typeof o.as !== "string") throw new KilnError("stamp `as` must be a name: it prefixes the stamped model's parts");
      for (const [k, v] of Object.entries((o.swap ?? {}) as Record<string, string>)) { mat(k); mat(v); }
      placeM(o);
      return ref("stamp", [name, o], `stamp("${name}")`);
    });
    env.scatter = (name: unknown, o: unknown) => at("scatter", () => {
      if (typeof name !== "string" || !isPlain(o)) throw new KilnError('scatter("name", { area: [x0, z0, x1, z1], count, scale: [min, max], rot, y, seed })');
      checkKeys("scatter", o, ["area", "count", "scale", "rot", "y", "seed", "swap"]);
      if (!Array.isArray(o.area) || o.area.length !== 4) throw new KilnError("scatter area: [x0, z0, x1, z1]");
      num(o.count, "count", 1);
      return ref("scatter", [name, o], `scatter("${name}", ${o.count})`);
    });
    env.group = (name: unknown, members: unknown) => at("group", (loc) => {
      if (typeof name !== "string" || !Array.isArray(members) || !members.every((m) => typeof m === "string")) throw new KilnError('group("name", ["a", "b*"])');
      this.groups.set(name, { name, members, loc });
    });
    env.pack = (name: unknown, entries: unknown, o: unknown = {}) => at("pack", (loc) => {
      if (typeof name !== "string" || !Array.isArray(entries) || !isPlain(o)) throw new KilnError('pack("name", ["tree*", "rock"], { spacing, cols })');
      checkKeys(`pack '${name}'`, o, ["spacing", "cols"]);
      this.packs.push({ name, entries, opts: o as PackDef["opts"], loc });
    });
    env.include = (path: unknown) => {
      if (typeof path !== "string") throw new KilnError('include("other.kx.js")', this.callerLoc());
      if (!this.includeHook) throw new KilnError("include() is not available here", this.callerLoc());
      this.includeHook(path);
    };
    env.rng = (seed?: number) => rng(seed);
    return env;
  }

  // ---------------------------------------------------------------- building

  exported(): string[] {
    return this.order.filter((n) => !n.startsWith("_"));
  }

  candidates(name: string, depth = 0): string[] {
    if (depth > 8) throw new KilnError(`group nesting too deep at '${name}'`);
    const g = this.groups.get(name);
    if (g) return g.members.flatMap((m) => this.candidates(m, depth + 1));
    if (name.includes("*")) {
      const list = this.order.filter((n) => globRe(name).test(n));
      if (!list.length) throw new KilnError(`'${name}' matches no models`);
      return list;
    }
    return [name];
  }

  packNames(p: PackDef): string[] {
    const out: string[] = [];
    for (const e of p.entries)
      for (const n of e.includes("*") ? this.exported().filter((x) => globRe(e).test(x)) : this.candidates(e))
        if (!out.includes(n)) out.push(n);
    return out;
  }

  build(name: string): Built {
    const def = this.models.get(name);
    if (!def) {
      if (this.groups.has(name) || name.includes("*")) throw new KilnError(`'${name}' is a group/glob: use it in stamp or scatter`);
      throw new KilnError(`unknown model '${name}'${didYouMean(name, this.order)}`);
    }
    const hit = this.cache.get(name);
    if (hit) return hit;
    if (this.building.has(name)) throw new KilnError(`reference cycle through '${name}'`);
    this.building.add(name);
    try {
      const out = this.buildDef(def);
      this.cache.set(name, out);
      return out;
    } catch (e) {
      throw wrap(e, (s) => this.locFromStack(s)).within(`model '${name}'`, def.loc);
    } finally {
      this.building.delete(name);
    }
  }

  private buildDef(def: ModelDef): Built {
    let faces: Face[] = [], lights: Light[] = [], joints: Joint[] = [];
    const steps: Built["steps"] = [];
    if (def.opts.base) {
      const b = this.build(def.opts.base);
      faces.push(...b.faces);
      lights.push(...b.lights);
      joints.push(...b.joints);
      steps.push({ label: `base '${def.opts.base}'`, loc: def.loc, end: faces.length });
    }
    for (const item of def.items) {
      const part = this.expand(item, 0);
      faces.push(...part.faces);
      lights.push(...part.lights);
      joints.push(...(part.joints ?? []));
      const st = isGeo(item) || isRef(item) ? item.step : { label: Array.isArray(item) ? `[${item.length} items]` : "item", loc: def.loc };
      steps.push({ label: st.label, loc: st.loc, end: faces.length });
    }
    if (def.opts.swap) faces = recolor(faces, def.opts.swap);
    if (def.opts.scale !== undefined) {
      const m = scaleM(vec(def.opts.scale, "scale", [1, 1, 1]));
      ({ faces, lights } = transformPart({ faces, lights }, m));
      joints = transformPart({ faces: [], lights: [], joints }, m).joints!;
    }
    const b = bounds(faces), pivot = def.opts.pivot ?? "bottom";
    if (pivot !== "origin" && faces.length) {
      const t: V3 = [-(b.min[0] + b.max[0]) / 2, pivot === "bottom" ? -b.min[1] : -(b.min[1] + b.max[1]) / 2, -(b.min[2] + b.max[2]) / 2];
      ({ faces, lights } = transformPart({ faces, lights }, translate(t)));
      joints = transformPart({ faces: [], lights: [], joints }, translate(t)).joints!;
    }
    const names = new Set<string>();
    for (const j of joints) {
      if (names.has(j.name)) throw new KilnError(`part '${j.name}' appears twice: stamp copies with { as: "name" } so their parts get unique names`);
      names.add(j.name);
    }
    for (const j of joints) if (j.parent && !names.has(j.parent)) throw new KilnError(`part '${j.name}': unknown parent '${j.parent}'${didYouMean(j.parent, names)}`);
    return { name: def.name, faces, steps, bounds: bounds(faces), tris: triCount(faces), pal: def.pal, lights, joints };
  }

  private expand(item: unknown, depth: number): Part {
    if (depth > 64) throw new KilnError("items nest too deep");
    if (item === null || item === undefined || item === false) return { faces: [], lights: [] };
    if (Array.isArray(item)) {
      const out: Part = { faces: [], lights: [], joints: [] };
      for (const v of item) { const p = this.expand(v, depth + 1); out.faces.push(...p.faces); out.lights.push(...p.lights); out.joints!.push(...(p.joints ?? [])); }
      return out;
    }
    if (isGeo(item)) return { faces: item.faces, lights: item.lights ?? [] };
    if (isRef(item)) {
      try { return this.resolve(item, depth); } catch (e) { throw wrap(e, (s) => this.locFromStack(s)).within(item.step.label, item.step.loc); }
    }
    const what = typeof item === "string" ? `the string ${JSON.stringify(item)}` : `a ${typeof item}`;
    throw new KilnError(`item is ${what}; items are shapes, voxels, tf, sym, stamp, scatter, or lists of those`);
  }

  private resolve(r: Ref, depth: number): Part {
    const a = r.args;
    if (r.__ref === "tf") return transformPart(this.expand(a.slice(1), depth + 1), placeM(a[0] as Record<string, unknown>));
    if (r.__ref === "sym") {
      const p = this.expand(a.slice(1), depth + 1);
      // The mirror copy's parts get a "~m" suffix so both sides can animate independently.
      const q = renameParts(transformPart(p, scaleM(a[0] === "x" ? [-1, 1, 1] : [1, 1, -1])), (n) => n + "~m");
      return { faces: [...p.faces, ...q.faces], lights: [...p.lights, ...q.lights], joints: [...(p.joints ?? []), ...(q.joints ?? [])] };
    }
    if (r.__ref === "part") {
      const [name, o] = a as [string, Record<string, unknown>];
      const p = this.expand(a.slice(2), depth + 1);
      return {
        faces: p.faces.map((f) => (f.part ? f : { ...f, part: name })),
        lights: p.lights.map((l) => (l.part ? l : { ...l, part: name })),
        joints: [{ name, parent: o.parent as string | undefined, pivot: vec(o.pivot, "pivot", [0, 0, 0]) },
          ...(p.joints ?? []).map((j) => (j.parent ? j : { ...j, parent: name }))],
      };
    }
    const name = a[0] as string, o = a[1] as Record<string, unknown>;
    const cands = this.candidates(name);
    const pick = (rr: () => number) => cands[Math.floor(rr() * cands.length) % cands.length];
    if (r.__ref === "stamp") {
      const b = this.build(pick(rng(hash(`${name}|${JSON.stringify(o.pos ?? 0)}`))));
      const f = o.swap ? recolor(b.faces, o.swap as Record<string, string>) : b.faces;
      const placed = transformPart({ faces: f, lights: b.lights, joints: b.joints }, placeM(o));
      return o.as ? renameParts(placed, (n) => `${o.as}.${n}`) : placed;
    }
    // scatter
    const [x0, z0, x1, z1] = o.area as number[];
    const rr = rng(Number(o.seed ?? hash(`${name}|${(o.area as number[]).join(",")}|${o.count}`)));
    const out: Part = { faces: [], lights: [] };
    const sc = o.scale as number | [number, number] | undefined;
    for (let i = 0; i < (o.count as number); i++) {
      const x = x0 + rr() * (x1 - x0), z = z0 + rr() * (z1 - z0);
      const s = Array.isArray(sc) ? sc[0] + rr() * (sc[1] - sc[0]) : sc ?? 1;
      const ry = o.rot === false ? 0 : Array.isArray(o.rot) ? o.rot[0] + rr() * (o.rot[1] - o.rot[0]) : rr() * 360;
      const b = this.build(pick(rr));
      const m = placeM({ pos: [x, Number(o.y ?? 0), z], rot: [0, ry, 0], scale: s });
      // Scattered copies are static set dressing: their parts fold into the body.
      const fs = (o.swap ? recolor(b.faces, o.swap as Record<string, string>) : b.faces).map((f) => (f.part ? { ...f, part: undefined } : f));
      out.faces.push(...transform(fs, m));
      out.lights.push(...transformLights(b.lights, m));
    }
    return out;
  }
}

