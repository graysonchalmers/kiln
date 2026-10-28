extends SceneTree
## Headless: godot --headless --path <client> --script res://tests/test_protocol.gd
const Net = preload("res://net.gd")
const Strip = preload("res://stage_strip.gd")
const Pacer = preload("res://stage_pacer.gd")
const VoxelView = preload("res://voxel_view.gd")
const Styles = preload("res://transition_styles.gd")

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
	var grids: Array = []
	net.stage_received.connect(func(i, g, t, gr):
		got.append([i, g.size(), t, g.slice(0, 4).get_string_from_ascii()])
		grids.append(gr))
	net.finished.connect(func(n): done.append(n))
	net.failed.connect(func(c, m): errs.append([c, m]))
	net.ingest(false, glb)  # binary with no stage event first: ignored
	net.ingest(true, '{"type":"stage","index":0,"tris":346,"t_ready":1.2,"grid":{"n":2,"cells":"ss.s","palette":{"s":"#aa5522"}}}'.to_utf8_buffer())
	net.ingest(false, glb)
	net.ingest(true, '{"type":"done","stages":1}'.to_utf8_buffer())
	check(got == [[0, 27816, 346, "glTF"]], "stage_received got %s" % [got])
	check(done == [1], "finished got %s" % [done])
	check(grids.size() == 1 and grids[0].get("n") == 2 and grids[0].get("cells") == "ss.s", "grid passed through %s" % [grids])
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

	# voxel bricks: only cells that touch air or the grid edge are drawn
	check(VoxelView.surface_indices("s", 1).size() == 1, "a single voxel is one brick")
	check(VoxelView.surface_indices("s".repeat(27), 3).size() == 26, "a 3x3x3 block has 26 surface bricks (centre hidden)")
	check(VoxelView.surface_indices(".".repeat(8), 2).size() == 0, "empty grid draws nothing")
	var ring := ("sss" + "sss" + "sss") + ("sss" + "s.s" + "sss") + ("sss" + "sss" + "sss")  # hollow centre
	check(VoxelView.surface_indices(ring, 3).size() == 26, "an enclosed void leaves the 26 outer bricks")
	var inst: MultiMeshInstance3D = VoxelView.build({"n": 2, "cells": "ss.s....", "palette": {"s": "#ff0000"}}, Vector3(0, 0, 0), Vector3(2, 2, 2), null)
	check(inst.multimesh.instance_count == 3, "3 filled cells -> 3 instances")
	check(VoxelView.cell_center(0, 2, Vector3.ZERO, Vector3(2, 2, 2)).is_equal_approx(Vector3(0.5, 0.5, 0.5)), "cell 0 centre")
	# flat index (y*n+z)*n+x : x=1, y=1, z=0 in a 2-grid is 1*4 + 0*2 + 1 = 5
	check(VoxelView.cell_center(5, 2, Vector3(10, 0, 0), Vector3(2, 4, 2)).is_equal_approx(Vector3(11.5, 3.0, 0.5)), "cell 5 centre in an offset, non-cubic box")
	check(VoxelView.brick_color({"s": "#ff0000"}, "s").is_equal_approx(Color("#ff0000")), "brick colour from the palette")
	check(VoxelView.brick_color({}, "x") == VoxelView.FALLBACK, "unknown key falls back to grey")
	inst.free()
	var sg = Strip.new()
	sg.add(glb, 5, {"n": 2})
	check(sg.stages[0]["grid"].get("n") == 2, "strip keeps the grid")
	var pg = Pacer.new()
	pg.push(glb, 7, {"n": 4})
	check(pg.pop_ready(0.0).get("grid", {}).get("n") == 4, "pacer carries the grid")

	check(Styles.NAMES == ["flip", "plane", "sparks", "scatter", "implode", "dissolve"], "six styles in order")
	check(Styles.index_of("implode") == 4 and Styles.index_of("SPARKS") == 2, "style by name, any case")
	check(Styles.index_of("3") == 3 and Styles.index_of("9") == 0 and Styles.index_of("nope") == 0, "style by number; unknown falls back to flip")
	check(Styles.next_index(5) == 0 and Styles.next_index(0) == 1, "T cycles and wraps")

	var pc = Pacer.new()
	pc.hold = 0.9
	for i in 3:
		pc.push(glb, 100 + i)
	check(pc.pop_ready(0.0).get("tris", -1) == 100, "first level shows immediately")
	check(pc.pop_ready(0.5).is_empty(), "second level waits out the hold")
	check(pc.pop_ready(0.9).get("tris", -1) == 101, "second level after the hold")
	check(pc.pop_ready(1.0).is_empty(), "third level waits")
	check(not pc.drained(), "not drained while a level is queued")
	check(pc.pop_ready(1.8).get("tris", -1) == 102, "third level after another hold")
	check(not pc.drained(), "not drained until the server says done")
	pc.finish()
	check(pc.drained(), "drained once finished and empty")
	pc.push(glb, 1)
	check(not pc.drained(), "a new level makes it undrained")
	pc.reset()
	check(pc.pop_ready(99.0).is_empty() and not pc.drained(), "reset clears the queue and the finished flag")

	if failures.is_empty():
		print("PASS test_protocol")
		quit(0)
	else:
		for f in failures:
			printerr("FAIL: " + f)
		quit(1)
