# Legion (PowerShell 5.1): render every transition style (a Godot window flashes for ~10 s per style), then make
# an MP4 per style, a stacked frame sheet and a labelled 3x2 grid video, and copy them to Downloads\envy.
param([string[]]$Styles = @("flip","plane","sparks","scatter","implode","dissolve"))
$out = "C:\Users\Grayson\claude-tmp\smoke"
$task = "C:\Users\Grayson\claude-tmp\live-client\tests\task_smoke.ps1"
foreach ($s in $Styles) {
  & powershell -NoProfile -File $task -Movie "$out\style_$s.avi" -Style $s -Sheet "-From 1.4 -Len 0.8 -Tile 4x1 -SheetFps 5 -TileW 400" | Select-Object -Last 1
  & ffmpeg -y -loglevel error -i "$out\style_$s.avi" -c:v libx264 -crf 22 -pix_fmt yuv420p "$out\style_$s.mp4"
}
$ins = @(); foreach ($s in $Styles) { $ins += @("-i", "$out\style_$s.avi.png") }
& ffmpeg -y -loglevel error @ins -filter_complex "vstack=inputs=$($Styles.Count)" "$out\styles_sheet.png"
if ($Styles.Count -eq 6) {
  $f = ""; $i = 0
  foreach ($s in $Styles) { $f += "[${i}:v]scale=640:360,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='$s':x=12:y=10:fontsize=30:fontcolor=white:box=1:boxcolor=0x00000099[v$i];"; $i++ }
  $f += "[v0][v1][v2]hstack=inputs=3[top];[v3][v4][v5]hstack=inputs=3[bot];[top][bot]vstack=inputs=2"
  Set-Content -Path "$out\grid.txt" -Value $f
  $mi = @(); foreach ($s in $Styles) { $mi += @("-i", "$out\style_$s.mp4") }
  & ffmpeg -y -loglevel error @mi -filter_complex_script "$out\grid.txt" -c:v libx264 -crf 23 -pix_fmt yuv420p "$out\all_styles.mp4"
}
$dst = "C:\Users\Grayson\Downloads\envy"; New-Item -ItemType Directory -Force $dst | Out-Null
foreach ($s in $Styles) { Copy-Item "$out\style_$s.mp4" $dst -Force }
Copy-Item "$out\styles_sheet.png" $dst -Force
if (Test-Path "$out\all_styles.mp4") { Copy-Item "$out\all_styles.mp4" $dst -Force }
"copied to $dst"
Get-ChildItem $dst -Filter "*style*" | Select-Object Name, Length
