extends SceneTree
## Needs a running server. godot --headless --path <client> --script res://tests/e2e.gd -- --server=ws://envy:PORT
const Net = preload("res://net.gd")

var t0 := 0.0
var stages := 0
var ok := false
var last_grid := {}
var net


func _init() -> void:
	net = Net.new()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--server="):
			net.url = a.substr(9)
	root.add_child(net)
	t0 = Time.get_ticks_msec() / 1000.0
	net.status.connect(func(t): print("status: ", t))
	net.stage_received.connect(func(i, g, tris, grid):
		stages += 1
		last_grid = grid
		print("stage %d tris=%d bytes=%d at %.2fs magic=%s grid_n=%s" % [i, tris, g.size(), Time.get_ticks_msec() / 1000.0 - t0, g.slice(0, 4).get_string_from_ascii(), grid.get("n", "none")]))
	net.finished.connect(func(n):
		ok = stages == n and n > 0
		print("finished ", n, " stages ok=", ok)
		if not ok:
			quit(1)
			return
		net.damage(last_grid, Vector3(1.0, 2.0, 0.8), 0.6, 1, "burn"))  # then the damage round trip
	net.damaged_received.connect(func(grid, amount):
		var changed: bool = grid.get("cells", "") != last_grid.get("cells", "")
		var charred: bool = str(grid.get("cells", "")).contains("~") and grid.get("materials", {}).get("~", "") == "charred"
		print("damaged amount=%.2f n=%s changed=%s charred=%s" % [amount, grid.get("n", "none"), changed, charred])
		quit(0 if changed and charred and grid.get("n", 0) == last_grid.get("n", -1) else 4))
	net.failed.connect(func(c, m):
		printerr("FAILED ", c, " ", m)
		quit(2))
	net.generate("wooden barrel", Vector3(1.0, 2.0, 0.8))
	create_timer(90.0).timeout.connect(func():
		printerr("TIMEOUT")
		quit(3))
