param([Parameter(Mandatory=$true)][string]$Archive, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$task034Allowed = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.qa/task034/tools'))
$task034Archive = [System.IO.Path]::GetFullPath($Archive)
$task034Destination = [System.IO.Path]::GetFullPath($Destination)
foreach ($task034Path in @($task034Archive, $task034Destination)) {
  if (-not $task034Path.StartsWith($task034Allowed + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Extraction path outside isolated tools workspace' }
}
$task034Zip = [System.IO.Compression.ZipFile]::OpenRead($task034Archive)
try {
  foreach ($task034Entry in $task034Zip.Entries) {
    if (-not $task034Entry.FullName.StartsWith('nsis-3.11/')) { throw 'Unexpected archive root' }
    $task034Resolved = [System.IO.Path]::GetFullPath((Join-Path $task034Destination $task034Entry.FullName))
    if (-not $task034Resolved.StartsWith($task034Destination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path traversal rejected' }
  }
} finally { $task034Zip.Dispose() }
[System.IO.Compression.ZipFile]::ExtractToDirectory($task034Archive, $task034Destination)
