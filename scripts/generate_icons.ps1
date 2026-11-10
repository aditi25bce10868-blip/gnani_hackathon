param(
    [string]$SourceImage = "icon.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceImage)) {
    Write-Error "Source image '$SourceImage' not found. Please provide a 1024x1024 PNG."
    exit 1
}

$srcBitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SourceImage).Path)

# Standard icon sizes
$sizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

# Adaptive foreground sizes (108dp base)
$fgSizes = @{
    "mipmap-mdpi"    = 108
    "mipmap-hdpi"    = 162
    "mipmap-xhdpi"   = 216
    "mipmap-xxhdpi"  = 324
    "mipmap-xxxhdpi" = 432
}

$resDir = "android\app\src\main\res"

function Resize-Image($src, $width, $height, $isRound = $false) {
    $dest = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($isRound) {
        $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $path.AddEllipse(0, 0, $width, $height)
        $g.SetClip($path)
    }

    $g.DrawImage($src, 0, 0, $width, $height)
    $g.Dispose()
    return $dest
}

foreach ($folder in $sizes.Keys) {
    $targetDir = Join-Path $resDir $folder
    if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
    
    $sz = $sizes[$folder]
    $fgSz = $fgSizes[$folder]

    # ic_launcher.png
    $icon = Resize-Image $srcBitmap $sz $sz $false
    $icon.Save((Join-Path $targetDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Dispose()

    # ic_launcher_round.png
    $iconRound = Resize-Image $srcBitmap $sz $sz $true
    $iconRound.Save((Join-Path $targetDir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $iconRound.Dispose()

    # ic_launcher_foreground.png
    $iconFg = Resize-Image $srcBitmap $fgSz $fgSz $false
    $iconFg.Save((Join-Path $targetDir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $iconFg.Dispose()

    Write-Host "Generated $folder icons (Square: ${sz}x${sz}, Round: ${sz}x${sz}, Fg: ${fgSz}x${fgSz})"
}

$srcBitmap.Dispose()
Write-Host "All Android mipmap icons generated successfully!"

