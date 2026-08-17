# Tujuan: menjalankan PostgreSQL lokal untuk development tanpa instalasi sistem.
# Strategy: unduh binaries portable PostgreSQL, init data dir, lalu start.
#
# Cara pakai:
#   powershell -ExecutionPolicy Bypass -File scripts/dev-postgres.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/dev-postgres.ps1 -Stop
#
# Kredensial dev yang dibuat:
#   superuser : postgres (trust auth, local)
#   role/db   : arto / arto_secret -> database "arto"

param(
    [int]   $Port = 5432,
    [string]$Root = "${env:LOCALAPPDATA}\arto-postgres",
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'

$version   = '16.4-1'
$zipUrl    = "https://get.enterprisedb.com/postgresql/postgresql-${version}-windows-x64-binaries.zip"
$zipFile   = Join-Path $Root "postgresql-${version}-windows-x64-binaries.zip"
$extractDir = Join-Path $Root 'pgsql'
$binDir     = Join-Path $extractDir 'bin'
$dataDir    = Join-Path $Root 'data'

New-Item -ItemType Directory -Force -Path $Root | Out-Null

if ($Stop) {
    if (-not (Test-Path (Join-Path $binDir 'pg_ctl.exe'))) {
        Write-Error "PostgreSQL portable tidak ditemukan di $binDir. Jalankan tanpa -Stop dulu."
    }
    & (Join-Path $binDir 'pg_ctl.exe') stop -D $dataDir -m fast
    Write-Output 'PostgreSQL dev berhenti.'
    exit 0
}

if (-not (Test-Path (Join-Path $binDir 'pg_ctl.exe'))) {
    Write-Output "Mengunduh PostgreSQL portable ($zipUrl) ..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing
    Write-Output "Mengekstrak ke $extractDir ..."
    Expand-Archive -Path $zipFile -DestinationPath $Root -Force
}

if (-not (Test-Path $dataDir)) {
    Write-Output 'Init database cluster ...'
    & (Join-Path $binDir 'initdb.exe') -D $dataDir -U postgres -A trust --encoding=UTF8 --no-locale | Out-Host
}

$logFile = Join-Path $Root 'postgres.log'
$running = & (Join-Path $binDir 'pg_isready.exe') -p $Port -q 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Output "Menjalankan PostgreSQL di port $Port ..."
    & (Join-Path $binDir 'pg_ctl.exe') start -D $dataDir -l $logFile -o "-p $Port" | Out-Host
}

# Siapkan role & database arto (idempotent)
$psql = Join-Path $binDir 'psql.exe'
$roleExists = & $psql -U postgres -h localhost -p $Port -tAc "SELECT 1 FROM pg_roles WHERE rolname='arto'" 2>$null
if ($roleExists -notmatch '1') {
    & $psql -U postgres -h localhost -p $Port -c "CREATE ROLE arto LOGIN PASSWORD 'arto_secret'" | Out-Host
    & $psql -U postgres -h localhost -p $Port -c "CREATE DATABASE arto OWNER arto" | Out-Host
}
Write-Output "PostgreSQL dev siap: postgresql://arto:arto_secret@localhost:$Port/arto"