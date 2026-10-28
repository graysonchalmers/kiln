# Legion (PowerShell 5.1): render the gallery shot in the interactive desktop session (a Godot window flashes for a few seconds).
param([string]$Shot = "C:\Users\Grayson\claude-tmp\smoke\gallery.png", [string]$Extra = "")
New-Item -ItemType Directory -Force (Split-Path $Shot) | Out-Null
if (Test-Path $Shot) { Remove-Item $Shot }
$log = "$Shot.log"; if (Test-Path $log) { Remove-Item $log }
$godot = "C:\Users\Grayson\AppData\Local\Programs\Godot\Godot_v4.7.2-stable_win64_console.exe"
$cmd = "& '$godot' --path C:\Users\Grayson\claude-tmp\live-client --resolution 1280x720 --quit-after 300 -- --gallery --style=flip '--shot=$Shot' $Extra *> '$log'"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$cmd`""
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$name = "LiveBlockoutGallery"
Register-ScheduledTask -TaskName $name -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $name
$t0 = Get-Date
do { Start-Sleep -Seconds 2; $state = (Get-ScheduledTask -TaskName $name).State } while ($state -eq "Running" -and ((Get-Date) - $t0).TotalSeconds -lt 90)
Unregister-ScheduledTask -TaskName $name -Confirm:$false
if (Test-Path $Shot) { "SHOT=$Shot $((Get-Item $Shot).Length) bytes" } else { "no shot written"; if (Test-Path $log) { Get-Content $log -Tail 15 } }
