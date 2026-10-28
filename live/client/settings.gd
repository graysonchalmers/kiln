extends RefCounted
## User settings kept in a small ConfigFile. Today: which transition style to play (implode unless changed).

const Styles = preload("res://transition_styles.gd")
const DEFAULT_STYLE := "implode"
const PATH := "user://settings.cfg"

var transition_style := DEFAULT_STYLE


## Keeps the defaults when the file is missing, unreadable, or names a style that does not exist.
func load_from(path: String = PATH) -> void:
	var cf := ConfigFile.new()
	if cf.load(path) != OK:
		return
	var name := str(cf.get_value("display", "transition_style", DEFAULT_STYLE)).to_lower()
	if Styles.NAMES.has(name):
		transition_style = name


func save_to(path: String = PATH) -> bool:
	var cf := ConfigFile.new()
	cf.set_value("display", "transition_style", transition_style)
	return cf.save(path) == OK
