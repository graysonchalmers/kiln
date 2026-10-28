extends SceneTree
## Headless: godot --headless --path <client> --script res://tests/test_protocol.gd
const Net = preload("res://net.gd")
const Strip = preload("res://stage_strip.gd")

var failures: Array[String] = []


func check(cond: bool, msg: String) -> void:
	if not cond:
		failures.append(msg)


func _init() -> void:
	var glb := FileAccess.get_file_as_bytes("res://tests/vend.glb")
	check(glb.size() == 27816, "fixture size %d" % glb.size())

	var net = Net.new()
	var got: Array = []
	var done: Array = []
	var errs: Array = []
	net.stage_received.connect(func(i, g, t): got.append([i, g.size(), t, g.slice(0, 4).get_string_from_ascii()]))
	net.finished.connect(func(n): done.append(n))
	net.failed.connect(func(c, m): errs.append([c, m]))
	net.ingest(false, glb)  # binary with no stage event first: ignored
	net.ingest(true, '{"type":"stage","index":0,"tris":346,"t_ready":1.2}'.to_utf8_buffer())
	net.ingest(false, glb)
	net.ingest(true, '{"type":"done","stages":1}'.to_utf8_buffer())
	check(got == [[0, 27816, 346, "glTF"]], "stage_received got %s" % [got])
	check(done == [1], "finished got %s" % [done])
	net.ingest(true, '{"type":"error","code":"generator_unavailable","message":"quota"}'.to_utf8_buffer())
	check(errs == [["generator_unavailable", "quota"]], "failed got %s" % [errs])
	net.ingest(true, "not json".to_utf8_buffer())  # must not crash

	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	check(doc.append_from_buffer(glb, "", st) == OK, "GLB parses")

	var strip = Strip.new()
	strip.add(glb, 346)
	strip.add(glb, 400)
	check(strip.select(1) and strip.selected == 1, "select 1")
	check(not strip.select(5) and strip.selected == 1, "select out of range is rejected")
	check(strip.step(-1) == 0 and strip.step(-1) == 0, "step clamps at 0")
	check(strip.step(5) == 1, "step clamps at last")
	var path: String = strip.lock("vend", "user://lock_test")
	check(path == "user://lock_test/vend_s2.glb", "lock path %s" % path)
	check(FileAccess.get_file_as_bytes(path).size() == 27816, "locked file size")

	if failures.is_empty():
		print("PASS test_protocol")
		quit(0)
	else:
		for f in failures:
			printerr("FAIL: " + f)
		quit(1)
