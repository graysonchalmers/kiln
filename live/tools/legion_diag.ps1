# Legion (PowerShell 5.1): READ-ONLY diagnostics for the windowed-Godot hang. Starts nothing, opens no window, changes nothing.
#   powershell -NoProfile -File C:\Projects-local\Tool-Blockout3D\live\tools\legion_diag.ps1 > $env:TEMP\legion_diag.txt ; notepad $env:TEMP\legion_diag.txt
# Looks for: a GPU driver installed or changed recently (a windowed render worked at 5:57 p.m.), driver resets and crashes,
# Godot logs, the Vulkan driver list, uptime. Paste the output back to the session.
$ErrorActionPreference = "SilentlyContinue"
$since = (Get-Date).AddHours(-14)
"=== video controllers (driver version and date: did it change today?)"
Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name) | driver $($_.DriverVersion) | date $($_.DriverDate) | status $($_.Status) | $($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution)" }
"=== GPU, driver and Windows Update events (last 14 hours)"
Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$since; ProviderName='nvlddmkm','Display','Microsoft-Windows-WindowsUpdateClient','Microsoft-Windows-Kernel-Power'} -MaxEvents 40 | ForEach-Object { $m = ($_.Message -split "`n")[0]; "$($_.TimeCreated.ToString('MM-dd HH:mm')) $($_.ProviderName) id=$($_.Id): $($m.Substring(0, [Math]::Min(130, $m.Length)))" }
"=== application crashes and hangs (last 14 hours)"
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$since; ProviderName='Application Error','Application Hang'} -MaxEvents 12 | ForEach-Object { "$($_.TimeCreated.ToString('MM-dd HH:mm')) $($_.ProviderName): $((($_.Message -split "`n")[0..2]) -join ' | ')" }
"=== Godot logs and processes"
Get-ChildItem "$env:APPDATA\Godot" -Recurse -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object { "$($_.LastWriteTime) $($_.FullName) $($_.Length) bytes" }
Get-Process -Name "Godot*" | ForEach-Object { "RUNNING: $($_.Name) pid=$($_.Id)" }
"=== Vulkan drivers registered"
(Get-ItemProperty "HKLM:\SOFTWARE\Khronos\Vulkan\Drivers").PSObject.Properties | Where-Object { $_.Name -like "*.json" } | ForEach-Object { $_.Name }
"=== power plan and uptime"
powercfg /getactivescheme
$up = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime; "up $($up.Days)d $($up.Hours)h $($up.Minutes)m"
