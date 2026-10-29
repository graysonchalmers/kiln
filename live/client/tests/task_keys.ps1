# Legion (PowerShell 5.1): run the client in a REAL Godot window in the logged-in desktop session (a window opens for about
# half a minute), drive it with key events (X, C, [, ]) against a running server and save a screenshot at each step.
param([Parameter(Mandatory)][string]$Server, [string]$OutDir = "C:\Users\Grayson\claude-tmp\keys", [string]$Prompt = "wooden barrel with iron hoops and flat wooden heads")
New-Item -ItemType Directory -Force $OutDir | Out-Null
Get-ChildItem "$OutDir\*" -Include "k*.png","demo.log" -ErrorAction SilentlyContinue | Remove-Item
$log = "$OutDir\run.log"; if (Test-Path $log) { Remove-Item $log }
$godot = "C:\Users\Grayson\AppData\Local\Programs\Godot\Godot_v4.7.2-stable_win64_console.exe"
$cmd = "& '$godot' --path C:\Users\Grayson\claude-tmp\live-client --resolution 1280x720 -- '--demo-keys=$Prompt' '--demo-out=$OutDir' '--server=$Server' --style=implode *> '$log'"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$cmd`""
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$name = "LiveBlockoutKeys"
Register-ScheduledTask -TaskName $name -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $name
$t0 = Get-Date
do { Start-Sleep -Seconds 2; $state = (Get-ScheduledTask -TaskName $name).State } while ($state -eq "Running" -and ((Get-Date) - $t0).TotalSeconds -lt 100)
function Stop-OurGodot { Get-CimInstance Win32_Process -Filter "Name like 'Godot%'" | Where-Object { $_.CommandLine -like '*claude-tmp\live-client*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }   # the console wrapper AND the real app behind it, only ours
if ($state -eq "Running") { Stop-ScheduledTask -TaskName $name; "stopped after the time limit" }
Stop-OurGodot
Unregister-ScheduledTask -TaskName $name -Confirm:$false
Get-ChildItem $OutDir -Filter "k*.png" | ForEach-Object { "$($_.Name) $($_.Length)" }
if (Test-Path "$OutDir\demo.log") { "--- demo.log"; Get-Content "$OutDir\demo.log" -Tail 25 }
if (Test-Path $log) { Get-Content $log -Tail 8 }
