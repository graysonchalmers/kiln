extends Node
## WebSocket client for the Live Blockout server. Text events describe a stage; the next binary frame is its GLB.

signal stage_received(index: int, glb: PackedByteArray, tris: int, grid: Dictionary)
signal damaged_received(grid: Dictionary, amount: float)
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


## Ask the server to burn or break a grid you hold (stateless: the grid travels with the request). The reply is one
## `damaged` event: parts that lose their support have already fallen. mode is "burn" or "break".
func damage(grid: Dictionary, size: Vector3, amount: float, seed_value: int = 1, mode: String = "burn") -> void:
	_close()
	var g := {"n": int(grid.get("n", 0)), "cells": grid.get("cells", ""), "palette": grid.get("palette", {}), "materials": grid.get("materials", {})}
	_request = JSON.stringify({"type": "damage", "grid": g, "size": [size.x, size.y, size.z], "amount": amount, "seed": seed_value, "mode": mode})
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
			"damaged":
				var dg = ev.get("grid", {})
				_close()  # one reply, no `done`; closed first so a handler may start the next request
				damaged_received.emit(dg if typeof(dg) == TYPE_DICTIONARY else {}, float(ev.get("amount", 0.0)))
			"done":
				_close()  # closed before the signal: a handler may start the next request on a new connection
				finished.emit(int(ev.get("stages", 0)))
			"error":
				_close()
				failed.emit(str(ev.get("code", "error")), str(ev.get("message", "")))
	elif not _pending_stage.is_empty():
		var st := _pending_stage
		_pending_stage = {}
		var g = st.get("grid", {})
		stage_received.emit(int(st.get("index", 0)), data, int(st.get("tris", 0)), g if typeof(g) == TYPE_DICTIONARY else {})


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
