extends Node
## WebSocket client for the Live Blockout server. Text events describe a stage; the next binary frame is its GLB.

signal stage_received(index: int, glb: PackedByteArray, tris: int)
signal finished(stages: int)
signal failed(code: String, message: String)
signal status(text: String)

var url := "ws://envy:8795"
var _ws: WebSocketPeer = null
var _request := ""
var _pending_stage: Dictionary = {}


func generate(prompt: String, size: Vector3) -> void:
	_close()
	_request = JSON.stringify({"type": "generate", "prompt": prompt, "size": [size.x, size.y, size.z]})
	_pending_stage = {}
	_ws = WebSocketPeer.new()
	_ws.inbound_buffer_size = 1 << 24
	_ws.max_queued_packets = 256
	var err := _ws.connect_to_url(url)
	if err != OK:
		_ws = null
		failed.emit("connect", "could not start connecting to %s (error %d)" % [url, err])
		return
	status.emit("connecting to %s ..." % url)


## Public so tests can feed recorded packets.
func ingest(is_text: bool, data: PackedByteArray) -> void:
	if is_text:
		var j := JSON.new()
		if j.parse(data.get_string_from_utf8()) != OK or typeof(j.data) != TYPE_DICTIONARY:
			return
		var ev: Dictionary = j.data
		match ev.get("type", ""):
			"stage":
				_pending_stage = ev
			"done":
				finished.emit(int(ev.get("stages", 0)))
				_close()
			"error":
				failed.emit(str(ev.get("code", "error")), str(ev.get("message", "")))
				_close()
	elif not _pending_stage.is_empty():
		var st := _pending_stage
		_pending_stage = {}
		stage_received.emit(int(st.get("index", 0)), data, int(st.get("tris", 0)))


func _close() -> void:
	if _ws != null:
		_ws.close()
	_ws = null


func _process(_delta: float) -> void:
	if _ws == null:
		return
	_ws.poll()
	var st := _ws.get_ready_state()
	if st == WebSocketPeer.STATE_OPEN and _request != "":
		_ws.send_text(_request)
		_request = ""
		status.emit("generating ...")
	while _ws != null and _ws.get_available_packet_count() > 0:
		var pkt := _ws.get_packet()
		ingest(_ws.was_string_packet(), pkt)
	if _ws != null and _ws.get_ready_state() == WebSocketPeer.STATE_CLOSED:
		var code := _ws.get_close_code()
		_ws = null
		if _request != "":
			failed.emit("connect", "could not reach %s (close code %d)" % [url, code])
