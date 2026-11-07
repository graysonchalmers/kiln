extends SceneTree
## Lineup spawn: every vending machine (v1, v2, v3) plus the field generator builds in with the Live Blockout implode,
## staggered left to right, then swaps to its textured mesh with a cyan glow fade. The mannequin just stands there.
##   godot --path P --resolution 1280x720 -s generator_spawn/lineup.gd -- still <t> out.png | clip <dir>
const VV := preload("res://voxel_view.gd")
const T0 := 0.4
const STAGGER := 0.6
const STEP := 0.9
const LEVELS := [4, 8, 16, 32]
const SWAP := 0.8
const FADE_DELAY := 0.2
const FADE := 0.4
const HOLD := 1.0
const FPS := 30.0
const GEN_X := 2.55

var items: Array = []  # {start, levels:[{inst, mat}], real, fade_mats, y0, y1, band}

func total() -> float:
	return T0 + STAGGER * 3 + STEP * LEVELS.size() + SWAP + FADE_DELAY + FADE + HOLD

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var s: Node3D = (load("res://main.tscn") as PackedScene).instantiate()
	root.add_child(s)
	(s.get_node("pbr") as Node3D).visible = false
	for l in s.find_children("*", "Label3D", true, false):
		if (l as Label3D).text.begins_with("PBR"):
			(l as Label3D).visible = false
	var shader: Shader = load("res://voxel_sweep.gdshader")
	var specs := [["v1", "grids_v1.json"], ["v2", "grids_v2.json"], ["v3", "grids_v3.json"], ["gen", "grids_gen.json"]]
	for i in specs.size():
		var D: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://generator_spawn/" + specs[i][1]))
		var bmin := Vector3(D.box_min[0], D.box_min[1], D.box_min[2])
		var bsize := Vector3(D.box_size[0], D.box_size[1], D.box_size[2])
		var real: Node3D
		var lift := 0.0
		if specs[i][0] == "gen":
			var doc := GLTFDocument.new()
			var st := GLTFState.new()
			doc.append_from_file(ProjectSettings.globalize_path("res://generator_spawn/generator-5k.glb"), st)
			real = doc.generate_scene(st)
			root.add_child(real)
			lift = -bmin.y
			real.position = Vector3(GEN_X, lift, 0)
		else:
			real = s.get_node(String(specs[i][0]))
		var origin := real.position
		bmin += origin
		var it := {"start": T0 + i * STAGGER, "levels": [], "real": real, "fade_mats": [],
			"y0": bmin.y, "y1": bmin.y + bsize.y, "band": bsize.y * 0.35}
		for n in LEVELS:
			var mat := ShaderMaterial.new()
			mat.shader = shader
			mat.set_shader_parameter("band", it.band)
			var inst := VV.build(D.grids[str(n)], bmin, bsize, mat)
			root.add_child(inst)
			it.levels.append({"inst": inst, "mat": mat})
		for m in real.find_children("*", "MeshInstance3D", true, false):
			var mi := m as MeshInstance3D
			for k in mi.mesh.get_surface_count():
				var sm := mi.get_active_material(k)
				if sm is StandardMaterial3D:
					sm = sm.duplicate()
					sm.emission_enabled = true
					sm.emission = Color(0.3, 0.9, 1.0)
					mi.set_surface_override_material(k, sm)
					it.fade_mats.append(sm)
		items.append(it)
	var c := Camera3D.new()
	root.add_child(c)
	c.current = true
	c.fov = 40
	c.look_at_from_position(Vector3(0.35, 1.9, 7.4), Vector3(0.35, 0.8, 0))
	if args[0] == "still":
		apply(float(args[1]))
		for f in 40: await process_frame
		var err := root.get_texture().get_image().save_png(args[2])
		print("LINEUP_STILL err=%d %s" % [err, args[2]])
	else:
		var nf := int(round(total() * FPS))
		apply(0.0)
		for f in 20: await process_frame
		for f in nf:
			apply(f / FPS)
			await process_frame
			await process_frame
			root.get_texture().get_image().save_png("%s/f_%04d.png" % [args[1], f])
		print("LINEUP_CLIP frames=%d" % nf)
	quit(0)

func sweep(it: Dictionary, u: float) -> float:
	u = clamp(u, 0.0, 1.0)
	return lerp(float(it.y0) - float(it.band) * 0.3, float(it.y1) + float(it.band) * 1.05, u)

func apply(t: float) -> void:
	for it in items:
		var st: float = it.start
		for k in LEVELS.size():
			var lv: Dictionary = it.levels[k]
			var mat: ShaderMaterial = lv.mat
			var inst: MultiMeshInstance3D = lv.inst
			var a0 := st + k * STEP
			var d0 := a0 + STEP
			var dur := SWAP if k == LEVELS.size() - 1 else STEP
			if t < a0 or t >= d0 + dur:
				inst.visible = false
			elif t < d0:
				inst.visible = true
				mat.set_shader_parameter("style", 4)
				mat.set_shader_parameter("mode", 1.0)
				mat.set_shader_parameter("line_y", sweep(it, (t - a0) / STEP))
			else:
				inst.visible = true
				mat.set_shader_parameter("style", 5)
				mat.set_shader_parameter("mode", 0.0)
				mat.set_shader_parameter("line_y", sweep(it, (t - d0) / dur))
		var swap0 := st + STEP * LEVELS.size()
		(it.real as Node3D).visible = t >= swap0
		var e: float = clamp(1.0 - (t - swap0 - FADE_DELAY) / FADE, 0.0, 1.0)
		for sm in it.fade_mats:
			(sm as StandardMaterial3D).emission_energy_multiplier = 1.6 * e * e
