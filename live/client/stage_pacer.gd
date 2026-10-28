extends RefCounted
## Holds arriving levels in a queue and releases one per `hold` seconds, so the dial-in is visible
## even when the server sends several levels within a fraction of a second.

var hold := 0.9
var _queue: Array = []
var _last := -1000.0
var _finished := false


func push(glb: PackedByteArray, tris: int, grid: Dictionary = {}) -> void:
	_queue.append({"glb": glb, "tris": tris, "grid": grid})


func finish() -> void:
	_finished = true


func reset() -> void:
	_queue.clear()
	_last = -1000.0
	_finished = false


## The next level if `hold` seconds have passed since the last release, else an empty dictionary.
func pop_ready(now: float) -> Dictionary:
	if _queue.is_empty() or now - _last < hold:
		return {}
	_last = now
	return _queue.pop_front()


func drained() -> bool:
	return _finished and _queue.is_empty()
