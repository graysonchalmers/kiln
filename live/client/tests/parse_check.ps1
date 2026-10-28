# Legion (PowerShell 5.1): headless parse/load check of the Godot project. usage: parse_check.ps1 -Project <dir> [-Seconds 60]
param([Parameter(Mandatory=$true)][string]$Project, [int]$Seconds = 60, [string]$Script = "", [string]$UserArg = "")
$godot = "C:\Users\Grayson\AppData\Local\Programs\Godot\Godot_v4.7.2-stable_win64_console.exe"
$out = Join-Path $env:TEMP "godot_parse_out.txt"; $err = Join-Path $env:TEMP "godot_parse_err.txt"
$p = Start-Process -FilePath $godot -ArgumentList $(if ($Script) { @("--headless","--path",$Project,"--script",$Script) + $(if ($UserArg) { @("--",$UserArg) } else { @() }) } else { @("--headless","--path",$Project,"--quit-after","30") }) -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
if (-not $p.WaitForExit($Seconds * 1000)) { $p.Kill(); "TIMEOUT after $Seconds s" }
Get-Content $out, $err -ErrorAction SilentlyContinue
"EXIT=$($p.ExitCode)"
