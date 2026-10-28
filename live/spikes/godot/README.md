# Spike B: draw a box, type a prompt, watch it build

Godot 4.3+ (GDScript). Not run yet: written without Godot installed.

## Run: Legion (PowerShell)
Install Godot 4.3+ yourself (e.g. `winget install GodotEngine.GodotEngine`), and Python 3.
Terminal 1 (prints `PORT=<n>`):
`python C:\Projects-local\spikeB\stub_server.py`
Terminal 2 (use that port; args after `--` are user args):
`$env:VS_PORT = "<n>"; godot --path C:\Projects-local\spikeB`
or `godot --path C:\Projects-local\spikeB -- --port=<n>`
(Copy this folder to the Legion first, or use its real path.)

## Run: Envy (bash)
`D=<absolute path of spikeB>; python3 $D/stub_server.py &` then
`VS_PORT=<n> godot --path $D` (or `-- --port=<n>`).

## Controls
WASD move, Q/E down/up, mouse look, Tab toggles mouse capture.
B = box mode (mouse freed): left-drag on floor = footprint, wheel = height.
Enter = prompt box, type, Enter sends `{"prompt":..., "size":[x,y,z]}`; Esc cancels.
The GLB arrives, is scaled to fit the box (uniform), based on the box floor, and reveals bottom-up over 1.5 s.

Test the stub alone: `python3 stub_server.py` then `python3 test_client.py <port>`.
