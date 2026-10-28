extends SceneTree
## Needs a running server. godot --headless --path <client> --script res://tests/e2e.gd -- --server=ws://envy:PORT
const Net = preload("res://net.gd")

var t0 := 0.0
var stages := 0
var ok := false


func _init() -> void:
	var net = Net.new()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--server="):
			net.url = a.substr(9)
	root.add_child(net)
	t0 = Time.get_ticks_msec() / 1000.0
	net.status.connect(func(t): print("status: ", t))
	net.stage_received.connect(func(i, g, tris, grid):
		stages += 1
		print("stage %d tris=%d bytes=%d at %.2fs magic=%s grid_n=%s" % [i, tris, g.size(), Time.get_ticks_msec() / 1000.0 - t0, g.slice(0, 4).get_string_from_ascii(), grid.get("n", "none")]))
	net.finished.connect(func(n):
		ok = stages == n and n > 0
		print("finished ", n, " stages ok=", ok)
		quit(0 if ok else 1))
	net.failed.connect(func(c, m):
		printerr("FAILED ", c, " ", m)
		quit(2))
	net.generate("wooden barrel", Vector3(1.0, 2.0, 0.8))
	create_timer(90.0).timeout.connect(func():
		printerr("TIMEOUT")
		quit(3))
