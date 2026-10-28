# Legion (PowerShell 5.1): run run_smoke.ps1 -Movie in the interactive desktop session via a one-off scheduled task, wait, print its log.
param([string]$Movie = "C:\Users\Grayson\claude-tmp\smoke\smoke.avi", [int]$Frames = 180, [string]$Sheet = "", [string]$Style = "flip")
$dir = Split-Path $Movie; New-Item -ItemType Directory -Force $dir | Out-Null
$log = Join-Path $dir "smoke.log"; if (Test-Path $log) { Remove-Item $log }
$cmd = "powershell -NoProfile -File C:\Users\Grayson\claude-tmp\live-client\tests\run_smoke.ps1 -Movie `"$Movie`" -Frames $Frames -Style $Style $Sheet *> `"$log`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$cmd`""
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$name = "LiveBlockoutSmoke"
Register-ScheduledTask -TaskName $name -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $name
$t0 = Get-Date
do { Start-Sleep -Seconds 2; $state = (Get-ScheduledTask -TaskName $name).State } while ($state -eq "Running" -and ((Get-Date) - $t0).TotalSeconds -lt 150)
Unregister-ScheduledTask -TaskName $name -Confirm:$false
"task state at end: $state"
if (Test-Path $log) { Get-Content $log } else { "no log written" }
