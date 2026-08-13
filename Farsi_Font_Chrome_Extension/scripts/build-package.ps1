param(
  [ValidateSet('public', 'private')]
  [string]$Flavor = 'public'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$privateIcon = Join-Path $projectRoot 'icon.private.png'
$outputDirectory = Join-Path $workspaceRoot 'dist'
$outputName = "Farsi_Font_Chrome_Extension.$Flavor.zip"
$outputPath = Join-Path $outputDirectory $outputName
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "farsi-font-extension-$Flavor-$([Guid]::NewGuid().ToString('N'))"

if ($Flavor -eq 'private' -and -not (Test-Path -LiteralPath $privateIcon -PathType Leaf)) {
  throw 'Private packaging requires Farsi_Font_Chrome_Extension/icon.private.png.'
}

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
  if ($Flavor -eq 'private') {
    Copy-Item -LiteralPath $privateIcon -Destination (Join-Path $stagingDirectory 'icon.png') -Force
  }
  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
  }
  Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $outputPath -CompressionLevel Optimal
  python -m zipfile -t $outputPath
} finally {
  Remove-Item -LiteralPath $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
