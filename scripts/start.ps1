param([string]$Mode = '')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Get-Setting([string]$Name, [string]$Default = '') {
    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrEmpty($value)) { return $Default }
    return $value
}

function Import-Settings([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { return }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -eq '' -or $line.StartsWith('#')) { continue }
        if ($line -notmatch '^((?:HIKYU_|SUPABASE_)[A-Za-z0-9_]+|PORT|SERVER_ADDRESS)=(.*)$') {
            throw "Invalid setting in ${Path}: use literal KEY=VALUE lines."
        }
        $key = $Matches[1]
        $value = $Matches[2]
        if ($value.Length -ge 2 -and (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        )) { $value = $value.Substring(1, $value.Length - 2) }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

if ($Mode -eq '--help' -or $Mode -eq '-h') {
    Write-Host 'Usage: start.cmd [local|cloud]'
    exit 0
}
if ($Mode -eq '') {
    Write-Host '1) Local Docker'
    Write-Host '2) Cloud (Supabase)'
    $selection = Read-Host 'Select database [1]'
    switch ($selection) {
        '' { $Mode = 'local' }
        '1' { $Mode = 'local' }
        '2' { $Mode = 'cloud' }
        default { throw 'Choose 1 or 2.' }
    }
}

if ($Mode -eq 'supabase') { $Mode = 'cloud' }
switch ($Mode) {
    'local' {
        $env:HIKYU_DB_MODE = 'local'
        foreach ($key in @('URL', 'USER', 'PASSWORD', 'NAME', 'PORT')) {
            [Environment]::SetEnvironmentVariable("HIKYU_DB_$key", $null, 'Process')
        }
        $config = '.env.example'
        if (Test-Path '.env.local') {
            $config = '.env.local'
            Import-Settings $config
        } elseif (Test-Path '.env') {
            $config = '.env'
            Import-Settings $config
        }
        $env:HIKYU_DB_NAME = Get-Setting 'HIKYU_LOCAL_DB_NAME' (Get-Setting 'HIKYU_DB_NAME' 'hikyu_bank')
        $env:HIKYU_DB_PORT = Get-Setting 'HIKYU_LOCAL_DB_PORT' (Get-Setting 'HIKYU_DB_PORT' '5432')
        $env:HIKYU_DB_USER = Get-Setting 'HIKYU_LOCAL_DB_USER' (Get-Setting 'HIKYU_DB_USER' 'hikyu')
        $env:HIKYU_DB_PASSWORD = Get-Setting 'HIKYU_LOCAL_DB_PASSWORD' (Get-Setting 'HIKYU_DB_PASSWORD' 'hikyu_local_demo')
        if ($env:HIKYU_DB_PORT -notmatch '^[0-9]{1,5}$' -or
            [int]$env:HIKYU_DB_PORT -lt 1 -or [int]$env:HIKYU_DB_PORT -gt 65535) {
            throw 'Local database port must be between 1 and 65535.'
        }
        if ($env:HIKYU_DB_NAME -notmatch '^[A-Za-z0-9_]+$') {
            throw 'Local database name must contain letters, numbers or underscores.'
        }
        $env:HIKYU_DB_URL = "jdbc:postgresql://127.0.0.1:$($env:HIKYU_DB_PORT)/$($env:HIKYU_DB_NAME)"
        if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
            throw 'Start/install Docker Desktop for local mode.'
        }
        Write-Host 'Database mode: local Docker PostgreSQL'
        & docker compose --env-file $config up -d --wait database
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    'cloud' {
        $env:HIKYU_DB_MODE = 'cloud'
        Import-Settings '.env.supabase'
        $url = Get-Setting 'HIKYU_DB_URL'
        if ($url -eq '') {
            $dbHost = Get-Setting 'SUPABASE_DB_HOST'
            if ($dbHost -eq '') { throw 'Set HIKYU_DB_URL or SUPABASE_DB_HOST in .env.supabase or your terminal.' }
            $dbPort = Get-Setting 'SUPABASE_DB_PORT' '5432'
            $dbName = Get-Setting 'SUPABASE_DB_NAME' 'postgres'
            $url = "jdbc:postgresql://${dbHost}:${dbPort}/${dbName}?sslmode=require"
        }
        if ($url -cnotmatch '^jdbc:postgresql://(\[[0-9A-Fa-f:]+\]|[A-Za-z0-9][A-Za-z0-9.-]*)(:[0-9]+)?/[A-Za-z0-9_-]+(\?[^\s]*)?$') {
            throw 'Invalid PostgreSQL JDBC URL. Check host, port and database; keep credentials separate.'
        }
        if ($url.Contains('sslmode=')) {
            if ($url -cnotmatch '[?&]sslmode=(require|verify-ca|verify-full)(&|$)') {
                throw 'Supabase mode requires sslmode=require, verify-ca or verify-full.'
            }
        } elseif ($url.Contains('?')) { $url += '&sslmode=require' }
        else { $url += '?sslmode=require' }
        $env:HIKYU_DB_URL = $url
        $env:HIKYU_DB_USER = Get-Setting 'SUPABASE_DB_USER' (Get-Setting 'HIKYU_DB_USER')
        $env:HIKYU_DB_PASSWORD = Get-Setting 'SUPABASE_DB_PASSWORD' (Get-Setting 'HIKYU_DB_PASSWORD')
        if ($env:HIKYU_DB_USER -eq '' -or $env:HIKYU_DB_PASSWORD -eq '') {
            throw 'Set the Supabase database username and password.'
        }
        Write-Host 'Database mode: cloud / Supabase PostgreSQL (Docker is not required)'
    }
    default { throw 'Unknown mode. Use local or cloud.' }
}

$webPort = Get-Setting 'PORT' '8080'
Write-Host "Web app: http://localhost:${webPort}/login.html"
Set-Location 'backend'
& .\mvnw.cmd spring-boot:run
exit $LASTEXITCODE
