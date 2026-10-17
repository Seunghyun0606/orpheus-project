param([Parameter(Mandatory=$true)][string]$Archive, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$nsisAllowed = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.qa/review/tools'))
$nsisArchive = [System.IO.Path]::GetFullPath($Archive)
$nsisDestination = [System.IO.Path]::GetFullPath($Destination)
foreach ($nsisPath in @($nsisArchive, $nsisDestination)) {
  if (-not $nsisPath.StartsWith($nsisAllowed + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Extraction path outside isolated tools workspace' }
}
$nsisZip = [System.IO.Compression.ZipFile]::OpenRead($nsisArchive)
try {
  foreach ($nsisEntry in $nsisZip.Entries) {
    if (-not $nsisEntry.FullName.StartsWith('nsis-3.11/')) { throw 'Unexpected archive root' }
    $nsisResolved = [System.IO.Path]::GetFullPath((Join-Path $nsisDestination $nsisEntry.FullName))
    if (-not $nsisResolved.StartsWith($nsisDestination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path traversal rejected' }
  }
} finally { $nsisZip.Dispose() }
[System.IO.Compression.ZipFile]::ExtractToDirectory($nsisArchive, $nsisDestination)
