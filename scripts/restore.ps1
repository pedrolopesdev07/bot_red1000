param([Parameter(Mandatory=$true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path -LiteralPath $BackupFile).Path
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw "O backup deve estar dentro do projeto." }
Get-Content -Raw -LiteralPath $resolved | docker compose exec -T postgres psql -U redacao -d redacao_db
