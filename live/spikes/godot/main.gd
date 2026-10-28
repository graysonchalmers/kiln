extends Node3D
## Spike B: draw a box in a 3D room, type a prompt, watch the GLB stream in.
## Keys: WASD move, Q/E down/up, mouse look, Tab capture toggle,
## B box mode (click-drag floor, wheel = height), Enter prompt, Esc cancel prompt.

const REVEAL_SECS := 1.5
const BAND := 0.08
const SHADER_PATH := "res://reveal.gdshader"

var port := 8765
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
var status: Label
var ui_root: Control

var ws: WebSocketPeer = null
var pending_json := ""
var req_min := Vector3.ZERO
var req_size := Vector3.ONE

var reveal_mats: Array[ShaderMaterial] = []
var reveal_meshes: Array = []  # [[MeshInstance3D, surface_count], ...]
var reveal_t := -1.0
var reveal_base := 0.0
var reveal_top := 1.0
var shader: Shader


func _ready() -> void:
	_parse_port()
	shader = load(SHADER_PATH) as Shader
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
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_set_status("Tab: mouse capture | B: box mode | Enter: prompt | port %d" % port)


func _parse_port() -> void:
	var env := OS.get_environment("VS_PORT")
	if env != "" and env.is_valid_int():
		port = env.to_int()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--port="):
			var v := a.substr(7)
			if v.is_valid_int():
				port = v.to_int()


func _build_room() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.12, 0.14, 0.2)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.6, 0.65, 0.8)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 35, 0)
	sun.shadow_enabled = true
	add_child(sun)

	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(20, 20)
	floor_mi.mesh = pm
	floor_mi.material_override = _flat(Color(0.35, 0.38, 0.45))
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
	status.position = Vector2(12, 8)
	ui_root.add_child(status)

	prompt_edit = LineEdit.new()
	prompt_edit.placeholder_text = "describe the asset, Enter to send, Esc to cancel"
	prompt_edit.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	prompt_edit.custom_minimum_size = Vector2(560, 36)
	prompt_edit.position = Vector2(360, 640)
	prompt_edit.size = Vector2(560, 36)
	prompt_edit.visible = false
	prompt_edit.text_submitted.connect(_on_prompt_submitted)
	ui_root.add_child(prompt_edit)


func _set_status(t: String) -> void:
	status.text = t


# ---------------------------------------------------------------- input

func _unhandled_input(event: InputEvent) -> void:
	if prompt_open:
		if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
			_close_prompt()
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
				_set_status("BOX MODE: drag on floor, wheel = height, Enter = prompt" if box_mode else "fly mode")
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
					p0 = h
					p1 = h
					has_box = false
			else:
				dragging = false
				if (p1 - p0).abs().x > 0.05 and (p1 - p0).abs().z > 0.05:
					has_box = true
					_redraw_wire()
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
			box_h = minf(box_h + 0.25, 10.0)
			_redraw_wire()
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			box_h = maxf(box_h - 0.25, 0.25)
			_redraw_wire()


## Returns Vector3 on the y=0 floor or null.
func _floor_hit(screen_pos: Vector2) -> Variant:
	var from := cam.project_ray_origin(screen_pos)
	var dir := cam.project_ray_normal(screen_pos)
	return Plane(Vector3.UP, 0.0).intersects_ray(from, dir)


func _open_prompt() -> void:
	prompt_open = true
	prompt_edit.text = ""
	prompt_edit.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	prompt_edit.call_deferred("grab_focus")


func _close_prompt() -> void:
	prompt_open = false
	prompt_edit.visible = false
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
	pending_json = JSON.stringify({"prompt": prompt, "size": [req_size.x, req_size.y, req_size.z]})
	ws = WebSocketPeer.new()
	ws.inbound_buffer_size = 1 << 24
	ws.max_queued_packets = 64
	var err := ws.connect_to_url("ws://127.0.0.1:%d" % port)
	if err != OK:
		_set_status("connect_to_url failed: %d" % err)
		ws = null
		return
	_set_status("connecting to port %d ..." % port)


func _poll_ws() -> void:
	if ws == null:
		return
	ws.poll()
	var st := ws.get_ready_state()
	if st == WebSocketPeer.STATE_OPEN and pending_json != "":
		ws.send_text(pending_json)
		pending_json = ""
		_set_status("generating ...")
	while ws != null and ws.get_available_packet_count() > 0:
		var pkt := ws.get_packet()
		if ws.was_string_packet():
			_set_status("server: " + pkt.get_string_from_utf8())
		else:
			_set_status("received %d bytes" % pkt.size())
			ws.close()
			_on_glb(pkt)
			ws = null
	if ws != null and ws.get_ready_state() == WebSocketPeer.STATE_CLOSED:
		_set_status("socket closed (code %d)" % ws.get_close_code())
		ws = null


# ---------------------------------------------------------------- asset + reveal

func _on_glb(buf: PackedByteArray) -> void:
	var doc := GLTFDocument.new()
	var gstate := GLTFState.new()
	var err := doc.append_from_buffer(buf, "", gstate)
	if err != OK:
		_set_status("GLB parse failed: %d" % err)
		return
	var root := doc.generate_scene(gstate)
	if root == null:
		_set_status("generate_scene returned null")
		return
	var holder := Node3D.new()
	holder.add_child(root)
	add_child(holder)  # identity transform, at origin

	var meshes: Array = []
	_collect_meshes(holder, meshes)
	var aabb := _world_aabb(meshes)
	if aabb.size.x <= 0.0001 or aabb.size.y <= 0.0001 or aabb.size.z <= 0.0001:
		_set_status("asset has degenerate bounds")
		return
	var s := minf(req_size.x / aabb.size.x, minf(req_size.y / aabb.size.y, req_size.z / aabb.size.z))
	holder.scale = Vector3.ONE * s
	var target := Vector3(req_min.x + req_size.x * 0.5, req_min.y, req_min.z + req_size.z * 0.5)
	var src := Vector3(aabb.get_center().x, aabb.position.y, aabb.get_center().z)
	holder.position = target - src * s

	reveal_base = req_min.y
	reveal_top = req_min.y + aabb.size.y * s
	_start_reveal(meshes)


func _collect_meshes(n: Node, out: Array) -> void:
	if n is MeshInstance3D and n.mesh != null:
		out.append(n)
	for c in n.get_children():
		_collect_meshes(c, out)


func _world_aabb(meshes: Array) -> AABB:
	var have := false
	var res := AABB()
	for mi in meshes:
		var a: AABB = mi.global_transform * mi.get_aabb()
		if not have:
			res = a
			have = true
		else:
			res = res.merge(a)
	return res


func _start_reveal(meshes: Array) -> void:
	reveal_mats.clear()
	reveal_meshes.clear()
	for mi: MeshInstance3D in meshes:
		var n := mi.mesh.get_surface_count()
		for i in n:
			var orig := mi.get_active_material(i)
			var sm := ShaderMaterial.new()
			sm.shader = shader
			var bm := orig as BaseMaterial3D
			if bm != null:
				sm.set_shader_parameter("albedo_color", bm.albedo_color)
				sm.set_shader_parameter("roughness_v", bm.roughness)
				sm.set_shader_parameter("metallic_v", bm.metallic)
				if bm.albedo_texture != null:
					sm.set_shader_parameter("albedo_tex", bm.albedo_texture)
					sm.set_shader_parameter("use_tex", true)
			sm.set_shader_parameter("band", BAND)
			sm.set_shader_parameter("clip_y", reveal_base - BAND)
			mi.set_surface_override_material(i, sm)
			reveal_mats.append(sm)
		reveal_meshes.append([mi, n])
	reveal_t = 0.0
	_set_status("building ...")


func _update_reveal(delta: float) -> void:
	if reveal_t < 0.0:
		return
	reveal_t += delta
	var k := clampf(reveal_t / REVEAL_SECS, 0.0, 1.0)
	var y := lerpf(reveal_base - BAND, reveal_top + BAND, k)
	for m in reveal_mats:
		m.set_shader_parameter("clip_y", y)
	if k >= 1.0:
		for e in reveal_meshes:
			var mi: MeshInstance3D = e[0]
			if is_instance_valid(mi):
				for i in e[1]:
					mi.set_surface_override_material(i, null)
		reveal_mats.clear()
		reveal_meshes.clear()
		reveal_t = -1.0
		_set_status("done")


# ---------------------------------------------------------------- loop

func _process(delta: float) -> void:
	_poll_ws()
	_update_reveal(delta)
	if prompt_open:
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
