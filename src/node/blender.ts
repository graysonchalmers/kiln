// Beauty renders through headless Blender: import the exported GLB, light it, frame it, render.
// Blender is bring-your-own: $KILN_BLENDER, `blender` on PATH, or the org.blender.Blender flatpak.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KilnError } from "../core/errors.ts";

export function blenderCommand(): string[] {
  if (process.env.KILN_BLENDER) return [process.env.KILN_BLENDER];
  if (!spawnSync("blender", ["--version"]).error) return ["blender"];
  const fp = spawnSync("flatpak", ["info", "org.blender.Blender"]);
  if (!fp.error && fp.status === 0) return ["flatpak", "run", "org.blender.Blender"];
  throw new KilnError("kiln render needs Blender: install it, put `blender` on PATH, or set KILN_BLENDER=/path/to/blender");
}

const SCRIPT = String.raw`
import bpy, sys, math, json
from mathutils import Vector
a = json.loads(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a["glb"])
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in objs:
    for p in o.data.polygons: p.use_smooth = False
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
ctr = (lo + hi) / 2; rad = max((hi - lo).length / 2, 0.01)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = a["w"], a["h"]
sc.render.film_transparent = a["transparent"]
sc.view_settings.view_transform = "AgX" if "AgX" in [v.identifier for v in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
try:
    sc.eevee.use_shadows = True
    sc.eevee.use_raytracing = True
    sc.eevee.taa_render_samples = a["samples"]
except Exception: pass
night = a["mood"] == "night"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.004, 0.005, 0.009, 1) if night else (0.045, 0.05, 0.07, 1); bg.inputs[1].default_value = 1 if night else 0.9
if night and a["fog"] > 0:
    # Haze in the air so lamp and neon light have something to shine through.
    vol = w.node_tree.nodes.new("ShaderNodeVolumePrincipled"); vol.inputs["Density"].default_value = a["fog"]
    try: vol.inputs["Anisotropy"].default_value = 0.4
    except Exception: pass
    w.node_tree.links.new(vol.outputs[0], w.node_tree.nodes["World Output"].inputs["Volume"])
    try:
        sc.eevee.volumetric_tile_size = "4"; sc.eevee.volumetric_samples = 96; sc.eevee.volumetric_end = rad * 8
    except Exception: pass
if a["ground"]:
    bpy.ops.mesh.primitive_plane_add(size=rad * 30, location=(ctr.x, ctr.y, lo.z))
    g = bpy.context.object; m = bpy.data.materials.new("ground"); m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.11, 0.115, 0.14, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    g.data.materials.append(m)
def light(kind, energy, rot, size, color=(1, 1, 1)):
    d = bpy.data.lights.new(kind, kind); d.energy = energy; d.color = color
    if kind == "SUN": d.angle = math.radians(size)
    else: d.size = size * rad
    o = bpy.data.objects.new(kind, d); sc.collection.objects.link(o)
    o.rotation_euler = [math.radians(r) for r in rot]
    if kind != "SUN": o.location = ctr + Vector((math.sin(math.radians(rot[2])) * rad * 4, -math.cos(math.radians(rot[2])) * rad * 4, rad * 3))
    return o
if night:
    light("SUN", 0.15, (55, 0, 160), 6, (0.55, 0.65, 1.0))      # a little moonlight; the scene's lights do the rest
else:
    light("SUN", 3.2, (50, 0, -35), 4, (1.0, 0.95, 0.88))
    light("SUN", 0.8, (60, 0, 150), 10, (0.7, 0.8, 1.0))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = a["lens"]
dist = rad / math.sin(math.atan(18 / cam.data.lens)) * 1.05 * (max(a["w"], a["h"]) / min(a["w"], a["h"]) if a["w"] < a["h"] else 1) / a["zoom"]
if a["focus"]:
    f = a["focus"]; ctr = Vector((f[0], -f[2], f[1]))     # glTF Y-up -> Blender Z-up
def aim(yaw_deg, pitch_deg=None, d=None):
    yaw, pitch = math.radians(yaw_deg), math.radians(a["pitch"] if pitch_deg is None else pitch_deg)
    cam.location = ctr + Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch))) * (dist if d is None else d)
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
aim(a["yaw"])
# Bloom for emissive parts: a Fog Glow glare in the compositor (API differs across versions).
def bloom():
    try:
        tree = bpy.data.node_groups.new("kiln_comp", "CompositorNodeTree")
        sc.compositing_node_group = tree
        out = tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        rl = tree.nodes.new("CompositorNodeRLayers"); gl = tree.nodes.new("CompositorNodeGlare"); go = tree.nodes.new("NodeGroupOutput")
    except Exception:
        sc.use_nodes = True
        tree = sc.node_tree
        rl = tree.nodes.get("Render Layers") or tree.nodes.new("CompositorNodeRLayers")
        go = tree.nodes.get("Composite") or tree.nodes.new("CompositorNodeComposite")
        gl = tree.nodes.new("CompositorNodeGlare")
    for k, v in (("glare_type", "FOG_GLOW"), ("quality", "HIGH"), ("threshold", 0.9), ("size", 7)):
        try: setattr(gl, k, v)
        except Exception: pass
    for name, v in (("Type", "Fog Glow"), ("Threshold", 0.9), ("Strength", 0.7), ("Size", 0.6)):
        try: gl.inputs[name].default_value = v
        except Exception: pass
    tree.links.new(rl.outputs["Image"], gl.inputs["Image"])
    tree.links.new(gl.outputs["Image"], go.inputs[0])
try:
    bloom(); print("KILN_BLOOM ok")
except Exception as e:
    print("KILN_BLOOM skipped", e)
if a["frames"] > 1 and a["move"]:
    # Camera move: ease from (yaw, pitch, zoom) to the *_to values.
    m = a["move"]; base = dist * a["zoom"]
    for i in range(a["frames"]):
        t = i / (a["frames"] - 1); e = t * t * (3 - 2 * t)
        lerp = lambda x, y: x + (y - x) * e
        aim(lerp(a["yaw"], m["yaw"]), lerp(a["pitch"], m["pitch"]), base / lerp(a["zoom"], m["zoom"]))
        sc.render.filepath = a["out"] % i
        bpy.ops.render.render(write_still=True)
elif a["frames"] > 1:
    for i in range(a["frames"]):
        aim(a["yaw"] + 360 * i / a["frames"])
        sc.render.filepath = a["out"] % i
        bpy.ops.render.render(write_still=True)
else:
    sc.render.filepath = a["out"]
    bpy.ops.render.render(write_still=True)
print("KILN_RENDERED", a["out"])
`;

export interface RenderOpts {
  w?: number;
  h?: number;
  yaw?: number;
  pitch?: number;
  samples?: number;
  ground?: boolean;
  transparent?: boolean;
  /** Turntable: render this many frames around the model; `outPng` must contain %d / %03d. */
  frames?: number;
  /** "night": dark world, dim moon, volumetric haze; the model's own lights do the work. */
  mood?: "day" | "night";
  /** Haze density for night renders (default 0.03; 0 = off). */
  fog?: number;
  /** Camera lens in mm (default 70). */
  lens?: number;
  /** Move the camera this many times closer than the fit-to-bounds distance (default 1). */
  zoom?: number;
  /** Look at this point (model coordinates, Y up) instead of the bounds center. */
  focus?: [number, number, number];
  /** Camera move instead of a turntable: ease yaw / pitch / zoom to these over the frames. */
  move?: { yaw: number; pitch: number; zoom: number };
}

/** Render a GLB to a PNG with Blender (EEVEE). Returns Blender's log on failure. */
export function blenderRender(glbBytes: Uint8Array, outPng: string, o: RenderOpts = {}): void {
  const cmd = blenderCommand();
  const dir = mkdtempSync(join(process.env.HOME ?? tmpdir(), ".kiln-render-"));
  try {
    const glbPath = join(dir, "model.glb"), script = join(dir, "render.py");
    writeFileSync(glbPath, glbBytes);
    writeFileSync(script, SCRIPT);
    const args = JSON.stringify({ glb: glbPath, out: outPng, w: o.w ?? 1600, h: o.h ?? 1200, yaw: o.yaw ?? 35, pitch: o.pitch ?? 22,
      samples: o.samples ?? 64, ground: o.ground !== false, transparent: !!o.transparent, frames: o.frames ?? 1,
      mood: o.mood ?? "day", fog: o.fog ?? 0.03, lens: o.lens ?? 70, zoom: o.zoom ?? 1, focus: o.focus ?? null,
      move: o.move ? { yaw: o.move.yaw, pitch: o.move.pitch, zoom: o.move.zoom } : null });
    const r = spawnSync(cmd[0], [...cmd.slice(1), "--background", "--factory-startup", "--python", script, "--", args], { encoding: "utf8", timeout: 600000 });
    if (r.error) throw new KilnError(`could not start Blender: ${r.error.message}`);
    if (process.env.KILN_DEBUG) console.error(String(r.stdout).split("\n").filter((l) => l.startsWith("KILN_")).join("\n"));
    if (!String(r.stdout).includes("KILN_RENDERED")) throw new KilnError(`Blender render failed:\n${String(r.stdout).split("\n").slice(-15).join("\n")}\n${r.stderr ?? ""}`);
    // A sandboxed Blender (flatpak) can "succeed" while writing somewhere the host can't see.
    const first = (o.frames ?? 1) > 1 ? outPng.replace(/%0?(\d*)d/, (_m, w) => "0".padStart(Number(w || 1), "0")) : outPng;
    if (!existsSync(first)) throw new KilnError(`Blender reported success but ${first} does not exist; a sandboxed Blender (flatpak) can only write inside your home directory`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
