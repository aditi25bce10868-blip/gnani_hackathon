Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Background: #1B1931
$bgColor = [System.Drawing.ColorTranslator]::FromHtml('#1B1931')
$bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
$g.FillRectangle($bgBrush, 0, 0, $size, $size)
$bgBrush.Dispose()

# Inner rounded container plate: #221F3A
$margin = 84
$plateSize = $size - ($margin * 2)
$r = 160
$platePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$rect = New-Object System.Drawing.Rectangle($margin, $margin, $plateSize, $plateSize)
$platePath.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
$platePath.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
$platePath.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90)
$platePath.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
$platePath.CloseFigure()

$plateColor = [System.Drawing.ColorTranslator]::FromHtml('#221F3A')
$plateBrush = New-Object System.Drawing.SolidBrush($plateColor)
$g.FillPath($plateBrush, $platePath)
$plateBrush.Dispose()

$borderColor = [System.Drawing.ColorTranslator]::FromHtml('#2B2547')
$borderPen = New-Object System.Drawing.Pen($borderColor, 6)
$g.DrawPath($borderPen, $platePath)
$borderPen.Dispose()

# Central motif: Interlocking conversation loops / stylized 'B' connection
$accentColor = [System.Drawing.ColorTranslator]::FromHtml('#ED9E59')
$penAccent = New-Object System.Drawing.Pen($accentColor, 40)
$penAccent.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penAccent.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$softColor = [System.Drawing.ColorTranslator]::FromHtml('#E9BCB9')
$penSoft = New-Object System.Drawing.Pen($softColor, 40)
$penSoft.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penSoft.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

# Left arc (Speaker 1)
$g.DrawArc($penAccent, 290, 312, 420, 420, 130, 190)
# Right arc (Speaker 2 / connection)
$g.DrawArc($penSoft, 314, 312, 420, 420, 310, 190)

# Central connection node (#A34054 primary)
$primaryColor = [System.Drawing.ColorTranslator]::FromHtml('#A34054')
$nodeBrush = New-Object System.Drawing.SolidBrush($primaryColor)
$g.FillEllipse($nodeBrush, 452, 462, 120, 120)
$nodeBrush.Dispose()

# Inner bright focus dot (#F2E6E4)
$dotColor = [System.Drawing.ColorTranslator]::FromHtml('#F2E6E4')
$dotBrush = New-Object System.Drawing.SolidBrush($dotColor)
$g.FillEllipse($dotBrush, 487, 497, 50, 50)
$dotBrush.Dispose()

# Outer satellite communication waves
$penAccentSmall = New-Object System.Drawing.Pen($accentColor, 24)
$penAccentSmall.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penAccentSmall.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$penSoftSmall = New-Object System.Drawing.Pen($softColor, 24)
$penSoftSmall.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penSoftSmall.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$g.DrawArc($penAccentSmall, 210, 232, 580, 580, 145, 70)
$g.DrawArc($penSoftSmall, 234, 232, 580, 580, 325, 70)

$penAccent.Dispose()
$penSoft.Dispose()
$penAccentSmall.Dispose()
$penSoftSmall.Dispose()
$platePath.Dispose()
$g.Dispose()

$outputPath = Join-Path (Get-Location) "icon.png"
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Created $outputPath successfully!"

