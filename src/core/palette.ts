// Materials by key. Colors are sRGB hex; glTF wants linear, converted at export.
import { KilnError, didYouMean } from "./errors.ts";

export interface Mat {
  color: string;
  rough: number;
  metal: number;
  /** Emissive color (glowing parts: lamps, lava, magic). */
  emit?: string;
  /** Emission strength (default 3 when `emit` is set). */
  glow?: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const SWEETIE = ["1a1c2c", "5d275d", "b13e53", "ef7d57", "ffcd75", "a7f070", "38b764", "257179",
  "29366f", "3b5dc9", "41a6f6", "73eff7", "f4f4f4", "94b0c2", "566c86", "333c57"];

export function normHex(c: string): string {
  if (!HEX.test(c)) throw new KilnError(`bad color '${c}': use "#rgb" or "#rrggbb"`);
  let h = c.slice(1).toLowerCase();
  if (h.length === 3) h = [...h].map((x) => x + x).join("");
  return "#" + h;
}

export function srgbToLinear(hex: string): [number, number, number] {
  const h = normHex(hex).slice(1);
  return [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

export class Palette {
  readonly mats: ReadonlyMap<string, Mat>;

  constructor(mats: Map<string, Mat>) {
    this.mats = mats;
  }

  static default(): Palette {
    return new Palette(new Map(SWEETIE.map((c, i) => [i.toString(16), { color: "#" + c, rough: 0.8, metal: 0 }])));
  }

  /** key: "#hex" | another key | { color, rough, metal, emit, glow } */
  extend(defs: Record<string, unknown>): Palette {
    const m = new Map(this.mats);
    for (const [k, v] of Object.entries(defs)) {
      if (!/^[A-Za-z0-9_]+$/.test(k)) throw new KilnError(`material key '${k}' must be letters, digits or _`);
      if (typeof v === "string") {
        if (HEX.test(v)) m.set(k, { color: normHex(v), rough: 0.8, metal: 0 });
        else m.set(k, { ...this.get(v, m) });
      } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        for (const key of Object.keys(o))
          if (!["color", "rough", "metal", "emit", "glow"].includes(key)) throw new KilnError(`material '${k}': unknown option '${key}'${didYouMean(key, ["color", "rough", "metal", "emit", "glow"])}`);
        if (typeof o.color !== "string") throw new KilnError(`material '${k}' needs a color "#hex"`);
        const mat: Mat = { color: normHex(o.color), rough: Number(o.rough ?? 0.8), metal: Number(o.metal ?? 0) };
        if (o.emit !== undefined) { mat.emit = normHex(String(o.emit)); mat.glow = Number(o.glow ?? 3); }
        m.set(k, mat);
      } else throw new KilnError(`material '${k}': use "#hex" or { color, rough, metal, emit, glow }`);
    }
    return new Palette(m);
  }

  has(k: string): boolean {
    return this.mats.has(k);
  }

  get(k: string, m: ReadonlyMap<string, Mat> = this.mats): Mat {
    const v = m.get(k);
    if (!v) {
      const keys = [...m.keys()];
      throw new KilnError(`unknown material '${k}'${didYouMean(k, keys)} (keys: ${keys.slice(0, 24).join(" ")}${keys.length > 24 ? " …" : ""})`);
    }
    return v;
  }
}
