param(
    [string]$SourcePath = "C:\Users\vineh\.gemini\antigravity\brain\2013efcb-7a08-4c72-8545-ea1157609fb2\.user_uploaded\media_1794266470914_bba7af71.jpg"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourcePath)) {
    Write-Error "Source file not found at $SourcePath"
    exit 1
}

$rawImg = [System.Drawing.Image]::FromFile($SourcePath)
Write-Host "Input image dimensions: $($rawImg.Width) x $($rawImg.Height)"

# Create a clean 1024x1024 master icon.png
$masterSize = 1024
$masterBmp = New-Object System.Drawing.Bitmap($masterSize, $masterSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$mg = [System.Drawing.Graphics]::FromImage($masterBmp)
$mg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$mg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$mg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$mg.DrawImage($rawImg, 0, 0, $masterSize, $masterSize)
$mg.Dispose()
$rawImg.Dispose()

$masterBmp.Save((Join-Path (Get-Location) "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Master icon.png (1024x1024) created."

# Now generate all mipmap sizes
$sizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

$fgSizes = @{
    "mipmap-mdpi"    = 108
    "mipmap-hdpi"    = 162
    "mipmap-xhdpi"   = 216
    "mipmap-xxhdpi"  = 324
    "mipmap-xxxhdpi" = 432
}

$resDir = "android\app\src\main\res"

function Render-Resized($src, $w, $h, $isRound = $false, $isForeground = $false) {
    $dest = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $w, $h)
        $g.SetClip($path)
        $g.DrawImage($src, 0, 0, $w, $h)
        $path.Dispose()
    } elseif ($isForeground) {
        # Adaptive foreground: In Android adaptive icons, the 108dp canvas has a safe zone in the inner 72dp (66.6%).
        # Scale the emblem slightly into the safe zone so launchers don't crop the mandala ring!
        $pad = [int]($w * 0.08)
        $innerSize = $w - ($pad * 2)
        $g.DrawImage($src, $pad, $pad, $innerSize, $innerSize)
    } else {
        $g.DrawImage($src, 0, 0, $w, $h)
    }

    $g.Dispose()
    return $dest
}

foreach ($folder in $sizes.Keys) {
    $targetDir = Join-Path $resDir $folder
    if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }

    $sz = $sizes[$folder]
    $fgSz = $fgSizes[$folder]

    # 1. ic_launcher.png (square)
    $icon = Render-Resized $masterBmp $sz $sz $false $false
    $icon.Save((Join-Path $targetDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Dispose()

    # 2. ic_launcher_round.png (circular)
    $iconRound = Render-Resized $masterBmp $sz $sz $true $false
    $iconRound.Save((Join-Path $targetDir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $iconRound.Dispose()

    # 3. ic_launcher_foreground.png (adaptive foreground layer)
    $iconFg = Render-Resized $masterBmp $fgSz $fgSz $false $true
    $iconFg.Save((Join-Path $targetDir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $iconFg.Dispose()

    Write-Host "Generated $folder icons (Square: ${sz}x${sz}, Round: ${sz}x${sz}, Foreground: ${fgSz}x${fgSz})"
}

$masterBmp.Dispose()
Write-Host "SUCCESS: All Android mipmap icons generated!"

