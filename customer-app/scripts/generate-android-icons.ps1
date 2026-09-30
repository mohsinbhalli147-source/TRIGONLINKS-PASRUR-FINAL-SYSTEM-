# Generates Android launcher icons as real PNGs, plus a foreground layer for the
# adaptive icon (API 26+).
#   powershell -File scripts\generate-android-icons.ps1
Add-Type -AssemblyName System.Drawing

$res = Join-Path $PSScriptRoot '..\android\app\src\main\res'
$res = (Resolve-Path $res).Path

function New-Icon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(255, 2, 6, 23))

    $blue = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)
    $cyan = [System.Drawing.Color]::FromArgb(255, 6, 182, 212)
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 79, 70, 229)), ($size * 0.10)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Two arcs flanking a centre dot: a signal mark that reads at 48px.
    $cx = $size / 2
    $cy = $size / 2
    $r = $size * 0.30
    $g.DrawArc($pen, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2), 130, 80)
    $g.DrawArc($pen, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2), 310, 80)

    $dot = $size * 0.11
    $g.FillEllipse((New-Object System.Drawing.SolidBrush $cyan), ($cx - $dot/2), ($cy - $dot/2), $dot, $dot)

    # A cyan-to-blue sweep so the mark is not flat.
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
        (New-Object System.Drawing.Rectangle 0,0,$size,$size), $cyan, $blue, 45.0
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $brush.Dispose(); $pen.Dispose(); $g.Dispose(); $bmp.Dispose()
}

# Legacy square + round icons.
$buckets = @{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
$count = 0
foreach ($density in $buckets.Keys) {
    $size = $buckets[$density]
    $dir = Join-Path $res "mipmap-$density"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    New-Icon $size (Join-Path $dir 'ic_launcher.png')
    New-Icon $size (Join-Path $dir 'ic_launcher_round.png')
    $count += 2
}

# Adaptive icon foreground: 108dp canvas, artwork inside the 66dp safe zone.
$fg = @{ mdpi = 108; hdpi = 162; xhdpi = 216; xxhdpi = 324; xxxhdpi = 432 }
foreach ($density in $fg.Keys) {
    $dir = Join-Path $res "mipmap-$density"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    New-Icon $fg[$density] (Join-Path $dir 'ic_launcher_foreground.png')
    $count += 1
}

Write-Output "wrote $count PNG icon files"
