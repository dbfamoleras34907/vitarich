<#
.SYNOPSIS
Tests the prepared structural migration against fms-dev and rolls it back.

.DESCRIPTION
Validates the prepared migration, replaces its final COMMIT with ROLLBACK in a
temporary copy, verifies the target Supabase project reference, and executes
the temporary copy with psql and ON_ERROR_STOP.

No successful schema change is retained. If SQL execution fails before the
explicit ROLLBACK, PostgreSQL rolls back the open transaction when psql closes.

.PARAMETER MigrationFile
Prepared structural migration to test.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$MigrationFile = (Join-Path $env:USERPROFILE 'Documents\SupabaseBackups\dev-to-fms-dev-structural.sql')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-RequiredCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found in PATH."
    }
    return $command.Source
}

function ConvertFrom-SecureStringToPlainText {
    param([Parameter(Mandatory)][Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Parse-PostgresUri {
    param([Parameter(Mandatory)][string]$ConnectionString)

    try {
        $uri = [Uri]$ConnectionString
    }
    catch {
        throw 'The connection string is not a valid PostgreSQL URI.'
    }

    if ($uri.Scheme -notin @('postgres', 'postgresql')) {
        throw 'Use a postgresql:// database URI, not the https:// Supabase API URL.'
    }

    $userInfoParts = $uri.UserInfo.Split(':', 2)
    if ($userInfoParts.Count -ne 2) {
        throw 'The PostgreSQL URI must contain both a username and password.'
    }

    $databaseUser = [Uri]::UnescapeDataString($userInfoParts[0])
    $databaseName = $uri.AbsolutePath.Trim('/')
    if ([string]::IsNullOrWhiteSpace($databaseName)) {
        $databaseName = 'postgres'
    }

    $projectRef = $null
    if ($databaseUser -match '^postgres\.([a-z0-9]+)$') {
        $projectRef = $matches[1]
    }
    elseif ($uri.Host -match '^db\.([a-z0-9]+)\.supabase\.co$') {
        $projectRef = $matches[1]
    }

    return [pscustomobject]@{
        Host = $uri.Host
        Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
        User = $databaseUser
        Password = [Uri]::UnescapeDataString($userInfoParts[1])
        Database = $databaseName
        ProjectRef = $projectRef
    }
}

function Invoke-ScalarQuery {
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][string]$Query,
        [Parameter(Mandatory)][string]$Description
    )

    $result = & $PsqlPath --no-psqlrc --tuples-only --no-align "--command=$Query"
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
    return (($result | Out-String).Trim())
}

$psqlPath = Resolve-RequiredCommand 'psql.exe'
$resolvedMigrationFile = [IO.Path]::GetFullPath($MigrationFile)

if (-not (Test-Path -LiteralPath $resolvedMigrationFile -PathType Leaf)) {
    throw "Prepared migration was not found: $resolvedMigrationFile"
}

$migrationSql = [IO.File]::ReadAllText($resolvedMigrationFile)
if ($migrationSql -notmatch '(?m)^-- STRUCTURAL MIGRATION FOR REVIEW AND TESTING ON FMS-DEV ONLY\.$') {
    throw 'The file is not the expected prepared structural migration.'
}

$beginMatches = [regex]::Matches($migrationSql, '(?im)^\s*begin\s*;\s*$')
$commitRegex = New-Object Text.RegularExpressions.Regex(
    '(?im)^\s*commit\s*;\s*$',
    [Text.RegularExpressions.RegexOptions]::IgnoreCase
)
$commitMatches = $commitRegex.Matches($migrationSql)
if ($beginMatches.Count -ne 1 -or $commitMatches.Count -ne 1) {
    throw "Expected exactly one BEGIN and one COMMIT; found $($beginMatches.Count) and $($commitMatches.Count)."
}

$nonTransactionalPattern = '(?im)^\s*(?:create\s+database|drop\s+database|alter\s+system|vacuum|create\s+(?:unique\s+)?index\s+concurrently|reindex\s+.*concurrently)\b'
if ([regex]::IsMatch($migrationSql, $nonTransactionalPattern)) {
    throw 'The migration contains a command that cannot be safely tested inside this rollback transaction.'
}

$testSql = $commitRegex.Replace($migrationSql, 'rollback;', 1)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$expectedProjectRef = (Read-Host 'Enter the fms-dev project reference').Trim().ToLowerInvariant()
if ($expectedProjectRef -notmatch '^[a-z0-9]+$') {
    throw 'The fms-dev project reference must contain only lowercase letters and numbers.'
}

$secureConnectionString = Read-Host 'Paste the fms-dev PostgreSQL Session Pooler URI' -AsSecureString
$plainConnectionString = ConvertFrom-SecureStringToPlainText $secureConnectionString
$connection = Parse-PostgresUri $plainConnectionString
$plainConnectionString = $null
$secureConnectionString.Dispose()

if (-not $connection.ProjectRef) {
    throw "Could not determine a project reference from database user '$($connection.User)'."
}
if ($connection.ProjectRef -ne $expectedProjectRef) {
    throw "Connection project reference '$($connection.ProjectRef)' does not match expected fms-dev reference '$expectedProjectRef'."
}

$temporaryTestFile = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($temporaryTestFile, $testSql, $utf8NoBom)

$previousPgEnvironment = @{
    PGHOST = $env:PGHOST
    PGPORT = $env:PGPORT
    PGUSER = $env:PGUSER
    PGPASSWORD = $env:PGPASSWORD
    PGDATABASE = $env:PGDATABASE
    PGSSLMODE = $env:PGSSLMODE
}

try {
    $env:PGHOST = $connection.Host
    $env:PGPORT = [string]$connection.Port
    $env:PGUSER = $connection.User
    $env:PGPASSWORD = $connection.Password
    $env:PGDATABASE = $connection.Database
    $env:PGSSLMODE = 'require'

    $connectedUser = Invoke-ScalarQuery -PsqlPath $psqlPath -Query 'select current_user;' -Description 'Target connection validation'
    Write-Host "Connected as: $connectedUser" -ForegroundColor Yellow

    $confirmation = Read-Host "Type TEST $expectedProjectRef to execute and roll back the migration"
    if ($confirmation -cne "TEST $expectedProjectRef") {
        throw 'Confirmation did not match. Nothing was tested.'
    }

    Write-Host 'Testing every migration statement on fms-dev; successful work will be rolled back' -ForegroundColor Cyan
    & $psqlPath --no-psqlrc --quiet --set=ON_ERROR_STOP=1 "--file=$temporaryTestFile"
    $testExitCode = $LASTEXITCODE

    if ($testExitCode -ne 0) {
        throw "Migration dry run failed with exit code $testExitCode. The transaction was rolled back."
    }

    Write-Host 'Migration dry run succeeded. PostgreSQL rolled back all tested changes.' -ForegroundColor Green
}
finally {
    foreach ($name in $previousPgEnvironment.Keys) {
        Set-Item -Path "Env:$name" -Value $previousPgEnvironment[$name]
    }
    $connection.Password = $null

    if (Test-Path -LiteralPath $temporaryTestFile) {
        Remove-Item -LiteralPath $temporaryTestFile -Force
    }
}
