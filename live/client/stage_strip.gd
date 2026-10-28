extends RefCounted
## Holds the GLB of each stage, the selected one, and locking a stage to disk.

var stages: Array = []  # [{glb: PackedByteArray, tris: int}]
var selected := -1


func clear() -> void:
	stages.clear()
	selected = -1


func add(glb: PackedByteArray, tris: int) -> int:
	stages.append({"glb": glb, "tris": tris})
	return stages.size() - 1


func count() -> int:
	return stages.size()


func select(i: int) -> bool:
	if i < 0 or i >= stages.size():
		return false
	selected = i
	return true


func step(d: int) -> int:
	if stages.is_empty():
		return -1
	selected = clampi(selected + d, 0, stages.size() - 1)
	return selected


## Writes the selected stage as <dir>/<slug>_s<N>.glb and returns the path ("" on failure).
func lock(slug: String, dir: String = "res://assets") -> String:
	if selected < 0 or selected >= stages.size():
		return ""
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var path := "%s/%s_s%d.glb" % [dir, slug, selected + 1]
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		return ""
	f.store_buffer(stages[selected]["glb"])
	f.close()
	return path
