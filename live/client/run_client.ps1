# Legion (PowerShell 5.1): open the Live Blockout client against the Envy server.
param([string]$Server = "ws://100.70.166.87:8795")
& "C:\Users\Grayson\AppData\Local\Programs\Godot\Godot_v4.7.2-stable_win64.exe" --path $PSScriptRoot -- "--server=$Server"
