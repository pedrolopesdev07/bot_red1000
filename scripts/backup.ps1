param([string]$Destination = ".\backups")
$ErrorActionPreference = "Stop"
$resolvedRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = Join-Path $resolvedRoot $Destination
New-Item -ItemType Directory -Force -Path $target | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $target "reda1000-$stamp.sql"
docker compose exec -T postgres pg_dump -U redacao -d redacao_db --clean --if-exists | Set-Content -Encoding utf8 $file
Write-Output "Backup criado em $file"
