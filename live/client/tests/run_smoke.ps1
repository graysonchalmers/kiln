# Legion (PowerShell 5.1): the scripted block -> 4 -> 8 -> 16 -> 32 transition.
#   -Headless : logic only (no rendering), prints errors
#   -Movie <avi> : renders with Godot's Movie Maker (needs the desktop session), then writes a contact sheet <avi>.png
param([string]$Project = "C:\Users\Grayson\claude-tmp\live-client", [switch]$Headless, [string]$Movie = "", [int]$Frames = 180, [int]$Fps = 30, [double]$From = 0, [double]$Len = 6, [string]$Tile = "6x6", [int]$SheetFps = 5, [int]$TileW = 320, [string]$Style = "flip")
$godot = "C:\Users\Grayson\AppData\Local\Programs\Godot\Godot_v4.7.2-stable_win64_console.exe"
$out = Join-Path $env:TEMP "godot_smoke_out.txt"; $err = Join-Path $env:TEMP "godot_smoke_err.txt"
if ($Headless) {
  $a = @("--headless","--path",$Project,"--quit-after",$Frames,"--","--smoke","--style=$Style")
} else {
  if (Test-Path $Movie) { Remove-Item $Movie }
  $a = @("--path",$Project,"--write-movie",$Movie,"--fixed-fps",$Fps,"--quit-after",$Frames,"--resolution","960x540","--","--smoke","--style=$Style")
}
$p = Start-Process -FilePath $godot -ArgumentList $a -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
if (-not $p.WaitForExit(120000)) { $p.Kill(); "TIMEOUT" }
Get-Content $out, $err -ErrorAction SilentlyContinue
if ($Movie -and (Test-Path $Movie)) {
  $sheet = "$Movie.png"
  & ffmpeg -y -loglevel error -ss $From -t $Len -i $Movie -vf "fps=$SheetFps,scale=${TileW}:-1,tile=$Tile" -frames:v 1 $sheet
  "MOVIE=$Movie $((Get-Item $Movie).Length) bytes; SHEET=$sheet"
}
