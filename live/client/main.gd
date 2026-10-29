extends Node3D
## Spike B: draw a box in a 3D room, type a prompt, watch the GLB stream in.
## Keys: WASD move, Q/E down/up, mouse look, Tab capture toggle,
## B box mode (click-drag floor, wheel = height), Enter prompt, Esc cancel prompt.

const REVEAL_SECS := 0.8   # the glowing line climbs the box in this long; bricks flip one row at a time as it passes
const PLANE_ALPHA := 0.24  # the 'plane' style only: one faint translucent plane
const SHRINK_TO := 0.9     # the placeholder block shrinks to this fraction as it fades
const SWEEP_SHADER := "res://voxel_sweep.gdshader"
const ROWS_IN_BAND := 2.5  # the flipping zone is about this many rows of the finer level tall
const VoxelView = preload("res://voxel_view.gd")
const Styles = preload("res://transition_styles.gd")
const Settings = preload("res://settings.gd")
const Net = preload("res://net.gd")
const Strip = preload("res://stage_strip.gd")
const Pacer = preload("res://stage_pacer.gd")

var server_url := "ws://envy:8795"
var cam: Camera3D
var yaw := 0.0
var pitch := -0.25
var move_speed := 5.0

var box_mode := false
var dragging := false
var p0 := Vector3.ZERO
var p1 := Vector3.ZERO
var box_h := 1.0
var has_box := false
var wire: MeshInstance3D
var wire_mesh: ImmediateMesh
var wire_color := Color(0.2, 0.9, 1.0)

var prompt_open := false
var prompt_edit: LineEdit
var prompt_panel: PanelContainer
var pips: Label
var height_set := false
var gen_done := false
var status: Label
var ui_root: Control

var net: Node
var strip = Strip.new()
var pacer = Pacer.new()
var placeholder: MeshInstance3D = null
var cur_view: MultiMeshInstance3D = null
var cur_mat: ShaderMaterial = null
var old_view: MultiMeshInstance3D = null
var old_mat: ShaderMaterial = null
var dmg_step := 0  # 0 = intact, 1..4 = burnt 25..100 percent (X)
const BURN_FRAMES := 24   # keyframes of a continuous burn, 0..100 percent (C plays, [ and ] scrub)
const BURN_FPS := 12.0
var burn_frames: Array = []
var burn_loading := false
var burn_idx := 0
var burn_dir := 0  # 1 = burning, -1 = un-burning, 0 = paused
var burn_t := 0.0
var demo_out := ""  # --demo-burn=<prompt> --demo-out=<dir>: scripted run, screenshots at each burn step
var demo_prompt := ""
var demo_state := ""
var demo_last_state := ""
var demo_keys := false  # --demo-keys: the same run but driven by key events (X, C, [, ]) through the input system
var demo_step := 0
var demo_f := 0
var demo_got_damage := false
var demo_shots := {}
var cur_slug := "asset"
var req_min := Vector3.ZERO
var req_size := Vector3.ONE

var reveal_t := -1.0
var sweep_line: MeshInstance3D = null
var sparks: CPUParticles3D = null
var style := Styles.index_of(Settings.DEFAULT_STYLE)
var settings = Settings.new()
var settings_panel: PanelContainer
var style_opt: OptionButton
var settings_open := false
var shot_path := ""
var room_walls: Array = []
var shot_frames := 0
var clock := 0.0
var smoke := false
var smoke_pending := false
var reveal_base := 0.0
var reveal_top := 1.0
var sweep_shader: Shader


func _ready() -> void:
	_parse_server()
	sweep_shader = load(SWEEP_SHADER) as Shader
	_build_room()
	_build_ui()
	wire_mesh = ImmediateMesh.new()
	wire = MeshInstance3D.new()
	wire.mesh = wire_mesh
	var wm := StandardMaterial3D.new()
	wm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	wm.vertex_color_use_as_albedo = true
	wm.no_depth_test = true
	wire.material_override = wm
	add_child(wire)
	net = Net.new()
	net.url = server_url
	add_child(net)
	net.stage_received.connect(_on_stage)
	net.finished.connect(_on_finished)
	net.damaged_received.connect(_on_damaged)
	net.failed.connect(_on_failed)
	net.status.connect(_set_status)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	settings.load_from()
	style = Styles.index_of(settings.transition_style)
	_parse_style()  # --style / VS_STYLE override the saved setting for this run
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			shot_path = a.substr(7)
	if OS.get_cmdline_user_args().has("--gallery"):
		_start_gallery()
		return
	if OS.get_cmdline_user_args().has("--smoke"):
		_start_smoke()
		return
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--demo-out="):
			demo_out = a.substr(11)
		if a.begins_with("--demo-burn="):
			demo_prompt = a.substr(12)
		if a.begins_with("--demo-keys="):
			demo_prompt = a.substr(12)
			demo_keys = true
	if demo_prompt != "":
		_start_demo_burn()
		return
	_set_status("B: draw a box | Tab: mouse | <-/->: stages | L: lock | T: style (%s) | O: settings | %s" % [Styles.NAMES[style], server_url])


## Scripted run for screenshots and video: a fixed box and the four barrel levels, no server needed.
func _start_smoke() -> void:
	smoke = true
	smoke_pending = true
	p0 = Vector3(-0.5, 0.0, -0.5)
	p1 = Vector3(0.5, 0.0, 0.5)
	box_h = 1.4
	has_box = true
	_redraw_wire()
	var b := _box_bounds()
	req_min = b[0]
	req_size = b[1]
	cur_slug = "smoke"
	pitch = -0.08
	yaw = 0.0
	cam.position = Vector3(0.35, 0.85, 2.0)
	cam.rotation = Vector3(pitch, yaw, 0.0)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_show_placeholder()
	_set_status("smoke test: block, then 4, 8, 16, 32 cells")


## Scripted run against a real server (needs --server=ws://host:port --demo-burn="wooden barrel" --demo-out=<dir>): generates the prop,
## presses X four times and then C, and saves a screenshot at each step and during each sweep. Steps wait for events, not timers.
func _start_demo_burn() -> void:
	p0 = Vector3(-0.5, 0.0, -0.5)
	p1 = Vector3(0.5, 0.0, 0.5)
	box_h = 1.4
	has_box = true
	_redraw_wire()
	var b := _box_bounds()
	req_min = b[0]
	req_size = b[1]
	pitch = -0.08
	yaw = 0.0
	cam.position = Vector3(0.35, 0.85, 2.0)
	cam.rotation = Vector3(pitch, yaw, 0.0)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	DirAccess.make_dir_recursive_absolute(demo_out)
	demo_state = "start"
	_set_status("demo: %s" % demo_prompt)


## A real key press (down and up) through the input system, so the same _unhandled_input that handles the keyboard runs.
func _press_key(code: Key) -> void:
	var down := InputEventKey.new()
	down.keycode = code
	down.physical_keycode = code
	down.pressed = true
	Input.parse_input_event(down)
	var up := InputEventKey.new()
	up.keycode = code
	up.physical_keycode = code
	up.pressed = false
	Input.parse_input_event(up)


## --demo-keys: X once, then C (continuous burn: load, play to the end, play back), pause, [ twice, ] once; a screenshot of
## the whole window (status line included) at each point. Steps wait for events, not timers.
func _keys_tick() -> void:
	demo_f += 1
	if demo_f % 120 == 1:
		_demo_log("tick f=%d fps=%d" % [demo_f, Engine.get_frames_per_second()])
	if demo_state != demo_last_state:
		demo_last_state = demo_state
		_demo_log("state %s strip=%d gen_done=%s" % [demo_state, strip.count(), gen_done])
	if clock > 120.0:  # safety: leave (and flush the log) instead of hanging
		_demo_log("giving up in state %s strip=%d status: %s" % [demo_state, strip.count(), status.text if status != null else "?"])
		get_tree().quit()
	match demo_state:
		"start":
			if clock >= 1.0:
				_send_request(demo_prompt)
				demo_state = "gen"
		"gen":
			if gen_done and strip.count() > 0 and reveal_t < 0.0 and pacer.drained():
				demo_f = 0
				demo_state = "settle0"
		"settle0":
			if demo_f >= 20:
				_demo_shot("k00_intact")
				demo_got_damage = false
				_press_key(KEY_X)
				demo_state = "x_wait"
		"x_wait":
			if demo_got_damage and reveal_t < 0.0:
				demo_f = 0
				demo_state = "x_settle"
		"x_settle":
			if demo_f >= 25:
				_demo_shot("k01_X_25")
				_press_key(KEY_C)
				demo_state = "c_load"
		"c_load":
			if burn_frames.size() >= BURN_FRAMES:
				demo_state = "c_play"
		"c_play":
			for k in [6, 12, 18]:
				if burn_idx >= k and not demo_shots.has(k):
					demo_shots[k] = true
					_demo_shot("k02_C_playing_%03d" % roundi(100.0 * k / float(BURN_FRAMES - 1)))
			if burn_idx >= BURN_FRAMES - 1 and burn_dir == 0:
				_demo_shot("k03_C_end_100")
				_press_key(KEY_C)  # reverse
				demo_state = "c_back"
		"c_back":
			if burn_idx <= 12 and burn_dir == -1:
				_demo_shot("k04_C_reverse_%03d" % roundi(100.0 * burn_idx / float(BURN_FRAMES - 1)))
				_press_key(KEY_C)  # pause
				demo_f = 0
				demo_state = "paused"
		"paused":
			if demo_f >= 6:
				var at := burn_idx
				_demo_shot("k05_C_paused_%03d" % roundi(100.0 * at / float(BURN_FRAMES - 1)))
				_press_key(KEY_BRACKETLEFT)
				_press_key(KEY_BRACKETLEFT)
				demo_f = 0
				demo_state = "left"
		"left":
			if demo_f >= 6:
				_demo_shot("k06_bracket_left_x2_%03d" % roundi(100.0 * burn_idx / float(BURN_FRAMES - 1)))
				_press_key(KEY_BRACKETRIGHT)
				demo_f = 0
				demo_state = "right"
		"right":
			if demo_f >= 6:
				_demo_shot("k07_bracket_right_%03d" % roundi(100.0 * burn_idx / float(BURN_FRAMES - 1)))
				demo_f = 0
				demo_state = "end"
		"end":
			if demo_f >= 20:
				print("demo done")
				get_tree().quit()
	if demo_f > 6000:  # safety
		get_tree().quit()


## Append a line to <demo-out>/demo.log and flush at once (stdout is buffered when redirected and lost if the process is killed).
func _demo_log(text: String) -> void:
	print(text)
	if demo_out == "":
		return
	var f := FileAccess.open(demo_out + "/demo.log", FileAccess.READ_WRITE if FileAccess.file_exists(demo_out + "/demo.log") else FileAccess.WRITE)
	if f == null:
		return
	f.seek_end()
	f.store_line("%.2f %s" % [clock, text])
	f.flush()


func _demo_shot(name: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [demo_out, name])
	_demo_log("shot " + name)


## Called every frame while the scripted run is going.
func _demo_tick() -> void:
	demo_f += 1
	match demo_state:
		"start":
			if clock >= 1.0:
				_send_request(demo_prompt)
				demo_state = "gen"
		"gen":
			if gen_done and strip.count() > 0 and reveal_t < 0.0 and pacer.drained():
				demo_f = 0
				demo_state = "settle"
		"settle":
			if demo_f >= 20:
				_demo_shot("00_intact")
				demo_step = 1
				demo_state = "press"
		"press":
			demo_got_damage = false
			_damage_next()
			demo_state = "wait"
		"wait":
			if demo_got_damage:
				demo_f = 0
				demo_state = "sweep"
		"sweep":
			# stills during the sweep (the old level shrinking away, the new burnt one assembling), then the settled one
			for f in [3, 9, 18]:
				if demo_f == f:
					_demo_shot("%02d_burn%d_sweep%d" % [demo_step, demo_step * 25, f])
			if demo_f >= 20 and reveal_t < 0.0:
				_demo_shot("%02d_burn%d_done" % [demo_step, demo_step * 25])
				demo_step += 1
				demo_state = "press" if demo_step <= 4 else "cont"
		"cont":
			_burn_toggle()
			demo_f = 0
			demo_state = "cont_play"
		"cont_play":
			if burn_dir != 0 or (not burn_frames.is_empty() and burn_idx > 0):
				for k in [3, 9, 16, 23]:
					if burn_idx >= k and not demo_shots.has(k):
						demo_shots[k] = true
						_demo_shot("05_continuous_%03d" % roundi(100.0 * k / float(BURN_FRAMES - 1)))
				if burn_idx >= BURN_FRAMES - 1 and burn_dir == 0:
					demo_f = 0
					demo_state = "end"
			if demo_f > 1800:  # safety: about a minute of simulated time
				demo_state = "end"
		"end":
			if demo_f >= 30:
				print("demo done")
				get_tree().quit()


## Every test prop side by side at 32 cells, for a visual regression shot. Needs tests/props/ (make_prop_fixtures.py).
func _start_gallery() -> void:
	var suffix := ""  # --gallery-set=burnt shows the burnt versions (tests/props/<name>_32_burnt.json)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--gallery-set="):
			suffix = "_" + a.substr(14)
	var man = JSON.parse_string(FileAccess.get_file_as_string("res://tests/props/props.json"))
	var cols := 5
	var spacing := 2.4
	for w in room_walls:
		w.visible = false  # keep the gallery shot free of the room's wall blocks
	for i in man.size():
		var e: Dictionary = man[i]
		var sz := Vector3(e["size"][0], e["size"][1], e["size"][2])
		sz *= 1.5 / maxf(sz.x, maxf(sz.y, sz.z))
		var grid = JSON.parse_string(FileAccess.get_file_as_string("res://tests/props/%s_32%s.json" % [e["name"], suffix]))
		var center := Vector3((i % cols - (cols - 1) * 0.5) * spacing, 0.0, 1.2 - (i / cols) * spacing)
		var mat := ShaderMaterial.new()
		mat.shader = sweep_shader
		mat.set_shader_parameter("mode", 1.0)
		mat.set_shader_parameter("line_y", 1.0e6)
		add_child(VoxelView.build(grid, Vector3(center.x - sz.x * 0.5, 0.0, center.z - sz.z * 0.5), sz, mat))
		var lab := Label3D.new()
		lab.text = e["name"]
		lab.pixel_size = 0.006
		lab.font_size = 48
		lab.rotation_degrees = Vector3(-90, 0, 0)
		lab.position = Vector3(center.x, 0.02, center.z + spacing * 0.42)
		add_child(lab)
	pitch = -0.9
	cam.position = Vector3(0.0, 5.5, 3.0)
	cam.rotation = Vector3(pitch, 0.0, 0.0)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_set_status("gallery: %d props at 32 cells%s" % [man.size(), " (" + suffix.substr(1) + ")" if suffix != "" else ""])
	if OS.get_cmdline_user_args().has("--open-settings"):
		_toggle_settings()


func _parse_style() -> void:
	var env := OS.get_environment("VS_STYLE")
	if env != "":
		style = Styles.index_of(env)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--style="):
			style = Styles.index_of(a.substr(8))


func _parse_server() -> void:
	var host := "envy"
	var port := 8795
	var env := OS.get_environment("VS_SERVER")
	if env != "":
		server_url = env
		return
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--server="):
			server_url = a.substr(9)
			return
		if a.begins_with("--host="):
			host = a.substr(7)
		if a.begins_with("--port=") and a.substr(7).is_valid_int():
			port = a.substr(7).to_int()
	server_url = "ws://%s:%d" % [host, port]


func _build_room() -> void:
	var env := Environment.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.09, 0.19, 0.42)
	sky_mat.sky_horizon_color = Color(0.58, 0.68, 0.82)
	sky_mat.ground_horizon_color = Color(0.36, 0.42, 0.52)
	sky_mat.ground_bottom_color = Color(0.16, 0.18, 0.24)
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY  # soft light from the sky dome instead of a flat colour
	env.ambient_light_energy = 0.62
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_white = 4.5
	env.ssao_enabled = true  # contact shadows between bricks and under props
	env.ssao_radius = 0.35
	env.ssao_intensity = 2.2
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.12
	env.adjustment_contrast = 1.06
	env.fog_enabled = true  # a touch of depth: the far floor fades into the sky
	env.fog_light_color = Color(0.40, 0.48, 0.62)
	env.fog_density = 0.016
	env.glow_enabled = true  # only really bright things bloom: the glowing bricks, not the lit surfaces
	env.glow_intensity = 0.8
	env.glow_bloom = 0.1
	env.glow_hdr_threshold = 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()  # warm key light, soft shadows
	sun.rotation_degrees = Vector3(-48, 40, 0)
	sun.light_color = Color(1.0, 0.93, 0.8)
	sun.light_energy = 1.8
	sun.shadow_enabled = true
	sun.shadow_blur = 1.4
	sun.shadow_normal_bias = 1.5
	add_child(sun)
	var fill := DirectionalLight3D.new()  # cool fill from the other side, no shadow, keeps the dark faces readable
	fill.rotation_degrees = Vector3(-30, -140, 0)
	fill.light_color = Color(0.55, 0.65, 0.92)
	fill.light_energy = 0.3
	add_child(fill)

	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(20, 20)
	floor_mi.mesh = pm
	floor_mi.material_override = _flat(Color(0.27, 0.30, 0.37))
	add_child(floor_mi)

	var wall_col := _flat(Color(0.7, 0.55, 0.45))
	# [center, size]
	var walls := [
		[Vector3(0, 1.5, -10), Vector3(20, 3, 0.4)],
		[Vector3(-10, 1.5, 0), Vector3(0.4, 3, 20)],
		[Vector3(10, 1.5, 0), Vector3(0.4, 3, 20)],
		[Vector3(-4, 0.75, -5), Vector3(3, 1.5, 0.4)],
		[Vector3(5, 1.0, -3), Vector3(0.4, 2, 5)],
	]
	for w in walls:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = w[1]
		mi.mesh = bm
		mi.material_override = wall_col
		mi.position = w[0]
		add_child(mi)
		room_walls.append(mi)

	cam = Camera3D.new()
	cam.position = Vector3(0, 1.7, 6)
	cam.rotation = Vector3(pitch, yaw, 0)
	add_child(cam)


func _flat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.9
	return m


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	ui_root = Control.new()
	ui_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(ui_root)

	status = Label.new()
	status.position = Vector2(14, 10)
	status.add_theme_font_size_override("font_size", 20)
	status.add_theme_color_override("font_outline_color", Color.BLACK)
	status.add_theme_constant_override("outline_size", 6)
	ui_root.add_child(status)

	pips = Label.new()
	pips.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	pips.offset_left = 14
	pips.offset_top = -120
	pips.offset_bottom = -80
	pips.add_theme_font_size_override("font_size", 22)
	pips.add_theme_color_override("font_outline_color", Color.BLACK)
	pips.add_theme_constant_override("outline_size", 6)
	ui_root.add_child(pips)

	prompt_panel = PanelContainer.new()
	prompt_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	prompt_panel.offset_left = 40
	prompt_panel.offset_right = -40
	prompt_panel.offset_top = -76
	prompt_panel.offset_bottom = -24
	prompt_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.08, 0.12, 0.92)
	sb.border_color = Color(0.2, 0.9, 1.0)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(8)
	sb.set_content_margin_all(10)
	prompt_panel.add_theme_stylebox_override("panel", sb)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	prompt_panel.add_child(row)
	var lab := Label.new()
	lab.text = "What goes in the box?"
	lab.add_theme_font_size_override("font_size", 22)
	row.add_child(lab)
	prompt_edit = LineEdit.new()
	prompt_edit.placeholder_text = "e.g. rusty vending machine   (Enter = build, Esc = cancel, wheel = box height)"
	prompt_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	prompt_edit.add_theme_font_size_override("font_size", 22)
	prompt_edit.text_submitted.connect(_on_prompt_submitted)
	row.add_child(prompt_edit)
	ui_root.add_child(prompt_panel)

	settings_panel = PanelContainer.new()
	settings_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	settings_panel.offset_left = -330
	settings_panel.offset_right = -14
	settings_panel.offset_top = 46
	settings_panel.visible = false
	settings_panel.add_theme_stylebox_override("panel", sb)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	settings_panel.add_child(col)
	var title := Label.new()
	title.text = "Settings   (O or Esc closes)"
	title.add_theme_font_size_override("font_size", 20)
	col.add_child(title)
	var srow := HBoxContainer.new()
	col.add_child(srow)
	var slab := Label.new()
	slab.text = "Transition style  "
	slab.add_theme_font_size_override("font_size", 18)
	srow.add_child(slab)
	style_opt = OptionButton.new()
	style_opt.add_theme_font_size_override("font_size", 18)
	for nm in Styles.NAMES:
		style_opt.add_item(nm)
	style_opt.item_selected.connect(_on_style_picked)
	srow.add_child(style_opt)
	ui_root.add_child(settings_panel)


func _set_status(t: String) -> void:
	status.text = t


# ---------------------------------------------------------------- input

func _unhandled_input(event: InputEvent) -> void:
	if settings_open:
		if event is InputEventKey and event.pressed and (event.keycode == KEY_ESCAPE or event.keycode == KEY_O):
			_toggle_settings()
		return
	if prompt_open:
		if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
			_close_prompt()
		elif event is InputEventMouseButton and event.pressed:
			if event.button_index == MOUSE_BUTTON_WHEEL_UP:
				_adjust_height(0.25)
			elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				_adjust_height(-0.25)
		return

	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_TAB:
				if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
					Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
				elif not box_mode:
					Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			KEY_B:
				box_mode = not box_mode
				dragging = false
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if box_mode else Input.MOUSE_MODE_CAPTURED
				_set_status("BOX MODE: drag a footprint on the floor (wheel = height); the prompt box opens when you let go" if box_mode else "fly mode")
			KEY_O:
				_toggle_settings()
			KEY_T:
				_set_style(Styles.next_index(style))
				_set_status("transition style: %s (T = next)" % Styles.NAMES[style])
			KEY_LEFT:
				_scrub(-1)
			KEY_RIGHT:
				_scrub(1)
			KEY_L:
				_lock_stage()
			KEY_X:
				_damage_next()
			KEY_C:
				_burn_toggle()
			KEY_BRACKETLEFT:
				_burn_step(-1)
			KEY_BRACKETRIGHT:
				_burn_step(1)
			KEY_ENTER, KEY_KP_ENTER:
				if has_box:
					_open_prompt()
				else:
					_set_status("Draw a box first (B, then drag on the floor)")
		return

	if event is InputEventMouseMotion:
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			yaw -= event.relative.x * 0.003
			pitch = clampf(pitch - event.relative.y * 0.003, -1.5, 1.5)
			cam.rotation = Vector3(pitch, yaw, 0)
		elif box_mode and dragging:
			var h = _floor_hit(event.position)
			if h != null:
				p1 = h
				has_box = true
				_redraw_wire()
		return

	if box_mode and event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				var h = _floor_hit(event.position)
				if h != null:
					dragging = true
					height_set = false
					p0 = h
					p1 = h
					has_box = false
			else:
				dragging = false
				if (p1 - p0).abs().x > 0.05 and (p1 - p0).abs().z > 0.05:
					has_box = true
					if not height_set:
						box_h = clampf(maxf(absf(p1.x - p0.x), absf(p1.z - p0.z)) * 1.6, 0.6, 3.0)
					_redraw_wire()
					box_mode = false  # leave box mode and ask what goes in it
					_open_prompt()
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_adjust_height(0.25)
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_adjust_height(-0.25)


func _set_style(i: int) -> void:
	style = i
	settings.transition_style = Styles.NAMES[style]
	settings.save_to()
	if style_opt != null:
		style_opt.select(style)


func _on_style_picked(i: int) -> void:
	_set_style(i)
	_set_status("transition style: %s" % Styles.NAMES[style])


func _toggle_settings() -> void:
	settings_open = not settings_open
	settings_panel.visible = settings_open
	style_opt.select(style)
	if settings_open:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if box_mode else Input.MOUSE_MODE_CAPTURED


func _adjust_height(d: float) -> void:
	height_set = true
	box_h = clampf(box_h + d, 0.25, 10.0)
	_redraw_wire()


## Returns Vector3 on the y=0 floor or null.
func _floor_hit(screen_pos: Vector2) -> Variant:
	var from := cam.project_ray_origin(screen_pos)
	var dir := cam.project_ray_normal(screen_pos)
	return Plane(Vector3.UP, 0.0).intersects_ray(from, dir)


func _open_prompt() -> void:
	prompt_open = true
	prompt_edit.text = ""
	prompt_panel.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	prompt_edit.call_deferred("grab_focus")


func _close_prompt() -> void:
	prompt_open = false
	prompt_panel.visible = false
	prompt_edit.release_focus()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if box_mode else Input.MOUSE_MODE_CAPTURED


func _on_prompt_submitted(text: String) -> void:
	_close_prompt()
	text = text.strip_edges()
	if text == "" or not has_box:
		return
	_send_request(text)


# ---------------------------------------------------------------- box

func _box_bounds() -> Array:
	var mn := Vector3(minf(p0.x, p1.x), 0.0, minf(p0.z, p1.z))
	var sz := Vector3(absf(p1.x - p0.x), box_h, absf(p1.z - p0.z))
	sz.x = maxf(sz.x, 0.1)
	sz.z = maxf(sz.z, 0.1)
	return [mn, sz]


func _redraw_wire() -> void:
	wire_mesh.clear_surfaces()
	if not has_box:
		return
	var b := _box_bounds()
	var mn: Vector3 = b[0]
	var sz: Vector3 = b[1]
	var c: Array[Vector3] = []
	for i in 8:
		c.append(mn + Vector3(sz.x * (i & 1), sz.y * ((i >> 1) & 1), sz.z * ((i >> 2) & 1)))
	var edges := [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
	wire_mesh.surface_begin(Mesh.PRIMITIVE_LINES)
	wire_mesh.surface_set_color(wire_color)
	for e in edges:
		wire_mesh.surface_set_color(wire_color)
		wire_mesh.surface_add_vertex(c[e[0]])
		wire_mesh.surface_set_color(wire_color)
		wire_mesh.surface_add_vertex(c[e[1]])
	wire_mesh.surface_end()


# ---------------------------------------------------------------- network

func _send_request(prompt: String) -> void:
	var b := _box_bounds()
	req_min = b[0]
	req_size = b[1]
	strip.clear()
	pacer.reset()
	_show_placeholder()
	_drop_views()
	cur_slug = _slug(prompt)
	gen_done = false
	_update_pips()
	net.generate(prompt, req_size)


func _slug(t: String) -> String:
	var out := ""
	for ch in t.to_lower():
		out += ch if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9") else "_"
	return out.left(24).strip_edges() if out != "" else "asset"


func _on_stage(_index: int, glb: PackedByteArray, tris: int, grid: Dictionary) -> void:
	pacer.push(glb, tris, grid)  # shown by _process, one level per hold interval


func _on_finished(_n: int) -> void:
	pacer.finish()  # "finished" is announced when the queue has been shown


func _show_placeholder() -> void:
	_clear_placeholder()
	placeholder = MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = req_size
	placeholder.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.75, 0.62, 0.5, 0.5)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.emission_enabled = true
	m.emission = Color(0.3, 0.22, 0.15)
	placeholder.material_override = m
	placeholder.position = req_min + req_size * 0.5
	add_child(placeholder)


func _clear_placeholder() -> void:
	if placeholder != null:
		placeholder.queue_free()
		placeholder = null


func _update_pips() -> void:
	var t := ""
	for i in strip.count():
		t += "● " if i == strip.selected else "○ "
	if strip.count() == 0:
		t = "waiting for the first voxels ..."
	elif gen_done:
		t += "  ✓ finished"
	else:
		t += "  building ..."
	pips.text = t


func _on_failed(code: String, message: String) -> void:
	pacer.reset()
	if strip.count() == 0:
		_clear_placeholder()
	gen_done = true
	_update_pips()
	_set_status("%s: %s" % ["generator unavailable" if code == "generator_unavailable" else code, message])


func _scrub(d: int) -> void:
	if strip.count() == 0:
		return
	_show_stage(strip.step(d), false)


## X: burn the shown level a bit more (25%, 50%, 75%, 100%, then back to intact). The server does the burning and lets
## unsupported parts fall; the same seed each press keeps the steps one story. Scrubbing or a new request resets it.
func _damage_next() -> void:
	if strip.count() == 0 or strip.selected < 0:
		return
	var grid: Dictionary = strip.stages[strip.selected]["grid"]
	if grid.is_empty():
		return
	dmg_step = (dmg_step + 1) % 5
	if dmg_step == 0:
		_show_stage(strip.selected, true)
		return
	net.damage(grid, req_size, dmg_step * 0.25, 1, "burn")
	_set_status("burning to %d%% ..." % (dmg_step * 25))


func _on_damaged(grid: Dictionary, amount: float) -> void:
	if grid.is_empty():
		return
	if burn_loading:
		burn_frames.append(grid)
		if burn_frames.size() >= BURN_FRAMES:
			burn_loading = false
			burn_idx = 0
			burn_dir = 1
			burn_t = 0.0
			_burn_show()
		else:
			_set_status("loading the burn ... %d/%d" % [burn_frames.size(), BURN_FRAMES])
		return
	demo_got_damage = true
	_show_grid(grid, true)
	_set_status("burnt %d%% | X = more | <-/-> back to the intact level" % roundi(amount * 100.0))


## C: burn the shown level continuously, 0 to 100 percent (24 keyframes from one server request, then played at 12 per
## second). C again pauses or reverses; [ and ] step one keyframe (about 4 percent). Scrubbing levels or a new request resets it.
func _burn_toggle() -> void:
	if strip.count() == 0 or strip.selected < 0:
		return
	if burn_frames.is_empty():
		var grid: Dictionary = strip.stages[strip.selected]["grid"]
		if burn_loading or grid.is_empty():
			return
		var amounts := []
		for k in BURN_FRAMES:
			amounts.append(k / float(BURN_FRAMES - 1))
		burn_loading = true
		net.damage_burn(grid, req_size, amounts, 1, "burn")
		_set_status("loading the burn ...")
		return
	if burn_dir != 0:
		burn_dir = 0
	else:
		burn_dir = 1 if burn_idx < burn_frames.size() - 1 else -1
	burn_t = 0.0


func _burn_step(d: int) -> void:
	if burn_frames.is_empty():
		return
	burn_dir = 0
	burn_idx = clampi(burn_idx + d, 0, burn_frames.size() - 1)
	_burn_show()


func _burn_show() -> void:
	_show_grid(burn_frames[burn_idx], false)
	_set_status("burnt %d%% | C play/pause | [ ] step | <-/-> back to the levels" % roundi(100.0 * burn_idx / float(BURN_FRAMES - 1)))


func _burn_reset() -> void:
	burn_frames.clear()
	burn_loading = false
	burn_dir = 0
	burn_idx = 0


func _burn_tick(delta: float) -> void:
	if burn_dir == 0 or burn_frames.is_empty():
		return
	burn_t += delta
	var moved := false
	while burn_t >= 1.0 / BURN_FPS and burn_dir != 0:
		burn_t -= 1.0 / BURN_FPS
		burn_idx += burn_dir
		moved = true
		if burn_idx >= burn_frames.size() - 1 or burn_idx <= 0:
			burn_idx = clampi(burn_idx, 0, burn_frames.size() - 1)
			burn_dir = 0  # holds at the end; C again plays it back
	if moved:
		_burn_show()


func _lock_stage() -> void:
	var p: String = strip.lock(cur_slug)
	_set_status("locked: " + ProjectSettings.globalize_path(p) if p != "" else "nothing to lock yet")


# ---------------------------------------------------------------- asset + reveal

func _show_stage(i: int, animate: bool) -> void:
	var grid: Dictionary = strip.stages[i]["grid"]
	if grid.is_empty():
		_end_transition()
		_set_status("level %d has no voxel grid" % (i + 1))
		return
	dmg_step = 0
	_burn_reset()
	_show_grid(grid, animate)
	_update_pips()
	_set_status("level %d/%d (%d cells a side) | <-/-> scrub | L lock | X burn" % [i + 1, strip.count(), int(grid["n"])])


## Show a voxel grid in the box; with animate the old one shrinks away under the sweep line as this one assembles.
func _show_grid(grid: Dictionary, animate: bool) -> void:
	_end_transition()
	var mat := ShaderMaterial.new()
	mat.shader = sweep_shader
	mat.set_shader_parameter("mode", 1.0)
	mat.set_shader_parameter("style", style)
	var view := VoxelView.build(grid, req_min, req_size, mat)
	add_child(view)
	if animate and cur_view != null:
		old_view = cur_view  # stays on screen, shrinking brick by brick, until the line has passed it
		old_mat = cur_mat
		old_mat.set_shader_parameter("mode", 0.0)
		old_mat.set_shader_parameter("style", style)
	else:
		_drop_current()
	cur_view = view
	cur_mat = mat
	reveal_base = req_min.y
	reveal_top = req_min.y + req_size.y
	if animate:
		var band: float = ROWS_IN_BAND * req_size.y / float(grid["n"])
		if style >= 3:
			band = maxf(band, 0.28 * req_size.y)  # the particle styles need room for bricks to travel
		for m in [cur_mat, old_mat]:
			if m != null:
				m.set_shader_parameter("band", band)
				m.set_shader_parameter("line_y", reveal_base - band)  # the line starts below the box
		reveal_t = 0.0
		_start_sweep_line()
	else:
		cur_mat.set_shader_parameter("line_y", 1.0e6)  # fully passed: every brick at full size
		_clear_placeholder()


func _drop_current() -> void:
	if cur_view != null:
		cur_view.queue_free()
	cur_view = null
	cur_mat = null


## Remove every level from the scene (a new request starts from the block).
func _drop_views() -> void:
	_end_transition()
	_drop_current()


func _start_sweep_line() -> void:
	if style == 2:
		_start_sparks()
	if style != 1:
		if sweep_line != null:
			sweep_line.visible = false
		return
	if sweep_line == null:
		sweep_line = MeshInstance3D.new()
		sweep_line.mesh = BoxMesh.new()
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.3, 1.0, 1.0, PLANE_ALPHA)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		sweep_line.material_override = m
		add_child(sweep_line)
	(sweep_line.mesh as BoxMesh).size = Vector3(req_size.x * 1.05, 0.004, req_size.z * 1.05)
	sweep_line.position = Vector3(req_min.x + req_size.x * 0.5, reveal_base, req_min.z + req_size.z * 0.5)
	sweep_line.visible = true


func _start_sparks() -> void:
	if sparks == null:
		sparks = CPUParticles3D.new()
		sparks.amount = 260
		sparks.lifetime = 0.55
		sparks.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
		sparks.direction = Vector3(0, 1, 0)
		sparks.spread = 70.0
		sparks.initial_velocity_min = 0.5
		sparks.initial_velocity_max = 1.6
		sparks.gravity = Vector3(0, -1.2, 0)
		sparks.scale_amount_min = 0.5
		sparks.scale_amount_max = 1.3
		var bm := BoxMesh.new()
		bm.size = Vector3(0.02, 0.02, 0.02)
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(0.5, 1.0, 1.0)
		m.emission_enabled = true
		m.emission = Color(0.4, 1.0, 1.0)
		m.emission_energy_multiplier = 4.0
		bm.material = m
		sparks.mesh = bm
		add_child(sparks)
	sparks.emission_box_extents = Vector3(req_size.x * 0.5, 0.01, req_size.z * 0.5)
	sparks.position = Vector3(req_min.x + req_size.x * 0.5, reveal_base, req_min.z + req_size.z * 0.5)
	sparks.emitting = true


## Finish whatever transition is running: the new level at full size, the old level and the block gone.
func _end_transition() -> void:
	reveal_t = -1.0
	if cur_mat != null:
		cur_mat.set_shader_parameter("line_y", 1.0e6)
	if old_view != null:
		old_view.queue_free()
		old_view = null
		old_mat = null
	_clear_placeholder()
	if sweep_line != null:
		sweep_line.visible = false
	if sparks != null:
		sparks.emitting = false


func _update_transition(delta: float) -> void:
	if reveal_t < 0.0:
		return
	reveal_t += delta
	var k := clampf(reveal_t / REVEAL_SECS, 0.0, 1.0)
	var band: float = cur_mat.get_shader_parameter("band")
	var y := lerpf(reveal_base - band, reveal_top + band, k)
	cur_mat.set_shader_parameter("line_y", y)
	if old_mat != null:
		old_mat.set_shader_parameter("line_y", y)
	if placeholder != null and is_instance_valid(placeholder):  # the block fades and shrinks as the first level arrives
		var e := k * k * (3.0 - 2.0 * k)
		var pm := placeholder.material_override as StandardMaterial3D
		pm.albedo_color.a = lerpf(0.5, 0.0, e)
		var mm := lerpf(1.0, SHRINK_TO, e)
		placeholder.scale = Vector3.ONE * mm
		placeholder.position = Vector3(req_min.x + req_size.x * 0.5, req_min.y + req_size.y * 0.5 * mm, req_min.z + req_size.z * 0.5)
	if sweep_line != null and sweep_line.visible:
		sweep_line.position.y = y
		(sweep_line.material_override as StandardMaterial3D).albedo_color.a = PLANE_ALPHA * (1.0 - k * k)
	if sparks != null and sparks.emitting:
		sparks.position.y = y
	if k >= 1.0:
		_end_transition()


# ---------------------------------------------------------------- loop

func _process(delta: float) -> void:
	clock += delta
	if shot_path != "":
		shot_frames += 1
		if shot_frames == 12:  # let the first frames render, then save one and leave
			get_viewport().get_texture().get_image().save_png(shot_path)
			get_tree().quit()
	_update_transition(delta)
	_burn_tick(delta)
	if demo_state != "":
		if demo_keys:
			_keys_tick()
		else:
			_demo_tick()
	if smoke_pending and clock >= 0.5:
		smoke_pending = false
		for n in [4, 8, 16, 32]:
			var grid = JSON.parse_string(FileAccess.get_file_as_string("res://tests/ladder_%d.json" % n))
			pacer.push(FileAccess.get_file_as_bytes("res://tests/ladder_%d.glb" % n), n, grid)
		pacer.finish()
	var nxt: Dictionary = pacer.pop_ready(clock)
	if not nxt.is_empty():
		var i: int = strip.add(nxt["glb"], nxt["tris"], nxt["grid"])
		strip.select(i)
		_show_stage(i, true)
	if pacer.drained() and not gen_done:
		gen_done = true
		_update_pips()
		_set_status("finished: %d levels%s | <-/-> scrub | L lock | B new box" % [strip.count(), "" if net.last_skipped.is_empty() else " (%d skipped: the server could not build them)" % net.last_skipped.size()])
	if prompt_open or settings_open:
		return
	var d := Vector3.ZERO
	if Input.is_physical_key_pressed(KEY_W): d.z -= 1
	if Input.is_physical_key_pressed(KEY_S): d.z += 1
	if Input.is_physical_key_pressed(KEY_A): d.x -= 1
	if Input.is_physical_key_pressed(KEY_D): d.x += 1
	if Input.is_physical_key_pressed(KEY_E): d.y += 1
	if Input.is_physical_key_pressed(KEY_Q): d.y -= 1
	if d != Vector3.ZERO:
		var basis_yaw := Basis(Vector3.UP, yaw)
		var move := basis_yaw * Vector3(d.x, 0, d.z) + Vector3(0, d.y, 0)
		cam.position += move.normalized() * move_speed * delta
