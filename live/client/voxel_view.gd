extends RefCounted
## Turns a voxel grid ({"n", "cells", "palette"}) into one MultiMesh of bricks, so each brick animates on its own.

const BRICK := 0.96  # a hair under the cell size so the rows read as separate bricks
const FALLBACK := Color(0.6, 0.6, 0.6)


## Flat indices ((y*n+z)*n+x) of filled cells that touch air or the grid edge; hidden interior bricks are skipped.
static func surface_indices(cells: String, n: int) -> PackedInt32Array:
	var out := PackedInt32Array()
	for y in n:
		for z in n:
			for x in n:
				var i := (y * n + z) * n + x
				if cells[i] == ".":
					continue
				if x == 0 or x == n - 1 or y == 0 or y == n - 1 or z == 0 or z == n - 1 \
						or cells[i - 1] == "." or cells[i + 1] == "." \
						or cells[i - n] == "." or cells[i + n] == "." \
						or cells[i - n * n] == "." or cells[i + n * n] == ".":
					out.append(i)
	return out


## World position of the centre of cell `i` in a grid of n^3 cells filling the box.
@warning_ignore("integer_division")
static func cell_center(i: int, n: int, box_min: Vector3, box_size: Vector3) -> Vector3:
	var cell := Vector3(box_size.x / n, box_size.y / n, box_size.z / n)
	return box_min + Vector3((i % n + 0.5) * cell.x, (i / (n * n) + 0.5) * cell.y, ((i / n) % n + 0.5) * cell.z)


static func brick_color(palette: Dictionary, key: String) -> Color:
	var hex: String = palette.get(key, "")
	return Color.from_string(hex, FALLBACK) if hex != "" else FALLBACK


## One MultiMeshInstance3D of bricks filling the box [box_min, box_min + box_size]; each brick's origin is its own centre.
static func build(grid: Dictionary, box_min: Vector3, box_size: Vector3, mat: Material) -> MultiMeshInstance3D:
	var n: int = grid["n"]
	var cells: String = grid["cells"]
	var palette: Dictionary = grid.get("palette", {})
	var idx := surface_indices(cells, n)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	mm.mesh = box
	mm.instance_count = idx.size()
	var cell := Vector3(box_size.x / n, box_size.y / n, box_size.z / n)
	var basis := Basis.from_scale(cell * BRICK)
	for k in idx.size():
		mm.set_instance_transform(k, Transform3D(basis, cell_center(idx[k], n, box_min, box_size)))
		mm.set_instance_color(k, brick_color(palette, cells[idx[k]]))
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = mm
	inst.material_override = mat
	return inst
