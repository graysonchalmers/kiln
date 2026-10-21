// Feedback from the live viewer: pins and strokes drawn on a view of a model. Each one is picked
// against the model at that exact view, so the agent gets surface points, materials, parts and the
// build step (with its source line) instead of screen pixels.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "../core/project.ts";
import { pick } from "../core/render.ts";

export class FeedbackError extends Error {}

const MAX_ITEMS = 300, MAX_POINTS = 20000, MAX_TEXT = 4000;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Validate and write `<out>/_feedback/<name>.{json,annotated.png}`. */
export function writeFeedback(p: Project, out: string, body: unknown): { files: string[]; summary: string } {
  if (typeof body !== "object" || body === null) throw new FeedbackError("feedback must be a JSON object");
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" && p.models.has(b.name) ? b.name : undefined;
  if (!name) throw new FeedbackError(`unknown model ${JSON.stringify(b.name)}`);
  const v = (b.view ?? {}) as Record<string, unknown>;
  if (!num(v.yaw) || !num(v.pitch) || !num(v.w) || !num(v.h) || v.w < 16 || v.h < 16 || v.w > 4096 || v.h > 4096) throw new FeedbackError("view needs yaw, pitch, w, h");
  const view = { yaw: v.yaw, pitch: v.pitch, w: Math.round(v.w), h: Math.round(v.h) };
  const m = p.build(name), opts = { ...view, fit: m.bounds };
  const text = (s: unknown) => (typeof s === "string" ? s.slice(0, MAX_TEXT) : "");
  const color = (s: unknown) => (typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : "#ff3df0");
  const stepOf = (face: number) => { const i = m.steps.findIndex((s) => face < s.end); return i < 0 ? null : { index: i, label: m.steps[i].label, loc: m.steps[i].loc ?? null }; };
  const hitAt = (x: number, y: number) => {
    const h = pick(m.faces, m.bounds, opts, x, y);
    return h ? { point: h.point.map(r3), normal: h.normal.map(r3), mat: h.mat, part: h.part ?? null, step: stepOf(h.face) } : null;
  };

  const pins = (Array.isArray(b.pins) ? b.pins : []).slice(0, MAX_ITEMS).flatMap((q) =>
    q && num(q.x) && num(q.y) && typeof q.text === "string" ? [{ x: q.x, y: q.y, text: text(q.text), color: color(q.color) }] : []);
  let total = 0;
  const strokes = (Array.isArray(b.strokes) ? b.strokes : []).slice(0, MAX_ITEMS).flatMap((s) => {
    if (!s || !Array.isArray(s.points)) return [];
    const pts = s.points.filter((q: unknown) => Array.isArray(q) && num(q[0]) && num(q[1])) as [number, number][];
    if (!pts.length || (total += pts.length) > MAX_POINTS) return [];
    return [{ color: color(s.color), points: pts }];
  });
  const comment = text(b.comment);

  const strokesOut = strokes.map((s, i) => {
    // what the stroke covers: hits grouped by build step and material, with their world bounds
    const hits = s.points.map(([x, y]) => hitAt(x, y)).filter((h) => h !== null);
    const by = new Map<string, { step: ReturnType<typeof stepOf>; mat: string; part: string | null; count: number; min: number[]; max: number[] }>();
    for (const h of hits) {
      const k = `${h.step?.index}|${h.mat}|${h.part}`;
      const g = by.get(k) ?? { step: h.step, mat: h.mat, part: h.part, count: 0, min: [...h.point], max: [...h.point] };
      g.count++; g.min = g.min.map((c, j) => Math.min(c, h.point[j])); g.max = g.max.map((c, j) => Math.max(c, h.point[j]));
      by.set(k, g);
    }
    return { n: i + 1, color: s.color, points: s.points.length, onModel: hits.length, covers: [...by.values()].sort((a, z) => z.count - a.count) };
  });

  const dir = join(out, "_feedback");
  mkdirSync(dir, { recursive: true });
  const files: string[] = [];
  const put = (file: string, data: string | Buffer) => { const path = join(dir, file); writeFileSync(path, data); files.push(path); };
  const hasPng = typeof b.annotated === "string" && b.annotated.startsWith("data:image/png;base64,");
  if (hasPng) put(`${name}.annotated.png`, Buffer.from((b.annotated as string).slice(22), "base64"));
  put(`${name}.json`, JSON.stringify({
    model: name, view, units: "meters, Y up, +Z toward the front (model space)", time: new Date().toISOString(), comment,
    pins: pins.map((q, i) => ({ n: i + 1, text: q.text, color: q.color, screen: [Math.round(q.x), Math.round(q.y)], hit: hitAt(q.x, q.y) })),
    strokes: strokesOut,
    images: { annotated: hasPng ? `${name}.annotated.png` : null },
  }, null, 1) + "\n");
  return { files, summary: `${pins.length} pin${pins.length === 1 ? "" : "s"}, ${strokes.length} stroke${strokes.length === 1 ? "" : "s"}${comment ? ", a comment" : ""}` };
}
