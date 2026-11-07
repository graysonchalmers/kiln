extends SceneTree
## Generator spawn: Live Blockout brick build-in (voxel_sweep.gdshader, implode) on a lineup slot, no :8795 server.
## Bricks come from a pre-voxelized grids.json (4/8/16/32, see voxelize.py); the real textured GLB swaps in at the end.
## Needs a display (xvfb-run). Usage:
##   godot --path P --resolution 1280x720 -s spawn.gd -- still <t_seconds> out.png
##   godot --path P --resolution 1280x720 -s spawn.gd -- clip <out_dir>      (frames f_0000.png.. at 30 fps)
const VV := preload("res://voxel_view.gd")
const SLOT := Vector3(0.114, 0.0, 0.0)  # the v2 slot of the lineup; v2 is hidden
const T0 := 0.4        # empty plinth
const STEP := 0.9      # one level change
const LEVELS := [8, 16, 32]
const SWAP := 0.8      # bricks dissolve off the textured mesh
const HOLD := 1.0
const FPS := 30.0

var levels: Array = []   # [{inst, mat}]
var final_mat: ShaderMaterial
var real: Node3D
var fade_mats: Array = []
const FADE := 0.4
var y0 := 0.0
var y1 := 1.0
var band := 0.35

func total() -> float:
	return T0 + STEP * LEVELS.size() + SWAP + HOLD

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var L: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://layout.json"))
	var s: Node3D = (load("res://main.tscn") as PackedScene).instantiate()
	root.add_child(s)
	for p in L.props:
		(s.get_node(String(p.id)) as Node3D).visible = false  # generator alone on the lineup
	var D: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://generator_spawn/grids.json"))
	var bmin := Vector3(D.box_min[0], D.box_min[1], D.box_min[2])
	var bsize := Vector3(D.box_size[0], D.box_size[1], D.box_size[2])
	var lift := -bmin.y  # rest the grid floor on the plinth
	bmin += SLOT + Vector3(0, lift, 0)
	y0 = bmin.y
	y1 = bmin.y + bsize.y
	band = bsize.y * 0.35
	var shader: Shader = load("res://voxel_sweep.gdshader")
	for n in LEVELS:
		var mat := ShaderMaterial.new()
		mat.shader = shader
		mat.set_shader_parameter("style", 4)
		mat.set_shader_parameter("band", band)
		var inst := VV.build(D.grids[str(n)], bmin, bsize, mat)
		root.add_child(inst)
		levels.append({"inst": inst, "mat": mat})
	# the real generator, loaded at run time (no import step)
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	doc.append_from_file(ProjectSettings.globalize_path("res://generator_spawn/generator-5k.glb"), st)
	real = doc.generate_scene(st)
	root.add_child(real)
	real.position = SLOT + Vector3(0, lift, 0)
	for m in real.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		for i in mi.mesh.get_surface_count():
			var sm := mi.get_active_material(i)
			if sm is BaseMaterial3D:
				sm = sm.duplicate()
				sm.emission_enabled = true
				sm.emission = Color(0.3, 0.9, 1.0)
				mi.set_surface_override_material(i, sm)
				fade_mats.append(sm)
	var c := Camera3D.new()
	root.add_child(c)
	c.current = true
	c.fov = 32
	c.look_at_from_position(SLOT + Vector3(1.19, 1.44, 3.63), SLOT + Vector3(0, 0.42, 0))
	if args[0] == "still":
		apply(float(args[1]))
		for f in 40: await process_frame
		var err := root.get_texture().get_image().save_png(args[2])
		print("SPAWN_STILL err=%d %s" % [err, args[2]])
	else:
		var nf := int(round(total() * FPS))
		apply(0.0)
		for f in 20: await process_frame
		for f in nf:
			apply(f / FPS)
			await process_frame
			await process_frame
			root.get_texture().get_image().save_png("%s/f_%04d.png" % [args[1], f])
		print("SPAWN_CLIP frames=%d" % nf)
	quit(0)

## Scene state at time t. Level k arrives (implode, mode 1) during [T0+k*STEP, T0+(k+1)*STEP] while level k-1 leaves
## with the same band (dissolve, mode 0); the last level dissolves off the real mesh during SWAP.
func sweep(u: float) -> float:
	u = clamp(u, 0.0, 1.0)
	return lerp(y0 - band * 0.3, y1 + band * 1.05, u)

func apply(t: float) -> void:
	var k_now := int(floor((t - T0) / STEP))
	for k in LEVELS.size():
		var lv: Dictionary = levels[k]
		var mat: ShaderMaterial = lv.mat
		var inst: MultiMeshInstance3D = lv.inst
		var a0 := T0 + k * STEP            # arrival start
		var d0 := a0 + STEP                # departure start (next level arriving)
		var dur := STEP
		if k == LEVELS.size() - 1:
			dur = SWAP
		if t < a0:
			inst.visible = false
		elif t < d0:
			inst.visible = true
			mat.set_shader_parameter("style", 4)
			mat.set_shader_parameter("mode", 1.0)
			mat.set_shader_parameter("line_y", sweep((t - a0) / STEP))
		elif t < d0 + dur:
			inst.visible = true
			mat.set_shader_parameter("style", 5)
			mat.set_shader_parameter("mode", 0.0)
			mat.set_shader_parameter("line_y", sweep((t - d0) / dur))
		else:
			inst.visible = false
	var swap0 := T0 + STEP * LEVELS.size()
	real.visible = t >= swap0
	var e: float = clamp(1.0 - (t - swap0 - 0.2) / FADE, 0.0, 1.0)
	for sm in fade_mats:
		(sm as BaseMaterial3D).emission_energy_multiplier = 3.0 * e * e
