$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot 'dist'
$outputName = "Farsi_Font_Chrome_Extension.zip"
$outputPath = Join-Path $outputDirectory $outputName
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "farsi-font-extension-$([Guid]::NewGuid().ToString('N'))"

New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

try {
  $items = @(
    'fonts', 'background.js', 'content.js', 'core.js', 'icon.png', 'icon-public.svg',
    'manifest.json', 'popup.css', 'popup.html', 'popup.js', 'sites.css', 'sites.html',
    'sites.js'
  )
  foreach ($item in $items) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $item) -Destination $stagingDirectory -Recurse
  }
  Get-ChildItem -LiteralPath $projectRoot -Filter '*.txt' -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $stagingDirectory
  }
  
  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
  }
  Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $outputPath -CompressionLevel Optimal
  python -m zipfile -t $outputPath
} finally {
  Remove-Item -LiteralPath $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
