<#
.SYNOPSIS
Applies the approved DEV-to-fms-dev public-schema migration.

.DESCRIPTION
This script is intentionally locked to the known fms-dev project reference and
the SHA-256 hash of the structural-v6.sql file that passed the rollback dry run.
It validates the migration and connection, requires an exact confirmation, runs
psql with ON_ERROR_STOP, and verifies important structural outcomes afterward.

This script changes fms-dev. It must never be pointed at the live fms project.

.PARAMETER MigrationFile
The exact structural-v6.sql file that passed the dry run.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$MigrationFile = (Join-Path $env:USERPROFILE 'Documents\SupabaseBackups\dev-to-fms-dev-structural-v6.sql')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$approvedProjectRef = 'glcmdjuwktlvuhbstbfj'
$approvedMigrationSha256 = '430e4764f29d7a114bb3569bc9b420b99d9377382a4ac8d46013cc667558282d'

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

    $result = & $PsqlPath --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 "--command=$Query"
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
    return (($result | Out-String).Trim())
}

$psqlPath = Resolve-RequiredCommand 'psql.exe'
$resolvedMigrationFile = [IO.Path]::GetFullPath($MigrationFile)

if (-not (Test-Path -LiteralPath $resolvedMigrationFile -PathType Leaf)) {
    throw "Approved migration was not found: $resolvedMigrationFile"
}

$actualMigrationSha256 = (Get-FileHash -LiteralPath $resolvedMigrationFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualMigrationSha256 -ne $approvedMigrationSha256) {
    throw @"
The migration file does not match the exact v6 file that passed the dry run.
Expected SHA-256: $approvedMigrationSha256
Actual SHA-256:   $actualMigrationSha256
Nothing was applied.
"@
}

$migrationSql = [IO.File]::ReadAllText($resolvedMigrationFile)
if ($migrationSql -notmatch '(?m)^-- STRUCTURAL MIGRATION FOR REVIEW AND TESTING ON FMS-DEV ONLY\.$') {
    throw 'The file is not the expected prepared structural migration.'
}

$beginCount = [regex]::Matches($migrationSql, '(?im)^\s*begin\s*;\s*$').Count
$commitCount = [regex]::Matches($migrationSql, '(?im)^\s*commit\s*;\s*$').Count
$rollbackCount = [regex]::Matches($migrationSql, '(?im)^\s*rollback\s*;\s*$').Count
if ($beginCount -ne 1 -or $commitCount -ne 1 -or $rollbackCount -ne 0) {
    throw "Expected one BEGIN, one COMMIT, and no ROLLBACK; found $beginCount, $commitCount, and $rollbackCount."
}

$nonTransactionalPattern = '(?im)^\s*(?:create\s+database|drop\s+database|alter\s+system|vacuum|create\s+(?:unique\s+)?index\s+concurrently|reindex\s+.*concurrently)\b'
if ([regex]::IsMatch($migrationSql, $nonTransactionalPattern)) {
    throw 'The migration contains a command that cannot run safely inside its transaction.'
}

$expectedDropTableCount = 3
$expectedDropColumnCount = 9
$expectedDeferredValidationCount = 484
$dropTableCount = [regex]::Matches($migrationSql, '(?im)^\s*drop\s+table\b').Count
$dropColumnCount = [regex]::Matches($migrationSql, '(?im)^\s*alter\s+table\b[^;]*drop\s+column\b').Count
$notValidConstraintCount = [regex]::Matches(
    $migrationSql,
    '(?im)^\s*alter\s+table\b[^;]*add\s+constraint\b[^;]*(?:check|foreign\s+key)\b[^;]*not\s+valid'
).Count
if (
    $dropTableCount -ne $expectedDropTableCount -or
    $dropColumnCount -ne $expectedDropColumnCount -or
    $notValidConstraintCount -ne $expectedDeferredValidationCount
) {
    throw 'The migration structural counts do not match the dry-run-approved v6 file.'
}

$enteredProjectRef = (Read-Host 'Enter the fms-dev project reference').Trim().ToLowerInvariant()
if ($enteredProjectRef -ne $approvedProjectRef) {
    throw "This script is locked to fms-dev project '$approvedProjectRef'. Nothing was applied."
}

$secureConnectionString = Read-Host 'Paste the fms-dev PostgreSQL Session Pooler URI' -AsSecureString
$plainConnectionString = ConvertFrom-SecureStringToPlainText $secureConnectionString
$connection = Parse-PostgresUri $plainConnectionString
$plainConnectionString = $null
$secureConnectionString.Dispose()

if (-not $connection.ProjectRef) {
    throw "Could not determine a project reference from database user '$($connection.User)'."
}
if ($connection.ProjectRef -ne $approvedProjectRef) {
    throw "Refusing apply: connection project '$($connection.ProjectRef)' is not the approved fms-dev project '$approvedProjectRef'."
}

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
    Write-Host ''
    Write-Host "Connected to approved fms-dev project: $approvedProjectRef" -ForegroundColor Yellow
    Write-Host "Connected as: $connectedUser"
    Write-Host "Migration: $resolvedMigrationFile"
    Write-Host "SHA-256:  $actualMigrationSha256"
    Write-Host "Intentional DROP TABLE statements:  $dropTableCount" -ForegroundColor Yellow
    Write-Host "Intentional DROP COLUMN statements: $dropColumnCount" -ForegroundColor Yellow
    Write-Host "Constraints left NOT VALID:         $notValidConstraintCount" -ForegroundColor Yellow
    Write-Host 'One blocking legacy RLS policy will be dropped.' -ForegroundColor Yellow
    Write-Host ''

    $hashPrefix = $actualMigrationSha256.Substring(0, 12)
    $requiredConfirmation = "APPLY $approvedProjectRef $hashPrefix"
    $confirmation = Read-Host "Type '$requiredConfirmation' to COMMIT the migration to fms-dev"
    if ($confirmation -cne $requiredConfirmation) {
        throw 'Confirmation did not match. Nothing was applied.'
    }

    Write-Host 'Applying the approved structural migration to fms-dev' -ForegroundColor Cyan
    & $psqlPath --no-psqlrc --quiet --set=ON_ERROR_STOP=1 "--file=$resolvedMigrationFile"
    $applyExitCode = $LASTEXITCODE
    if ($applyExitCode -ne 0) {
        throw "Migration failed with exit code $applyExitCode. PostgreSQL rolled back the open transaction."
    }

    $verificationQuery = @"
select concat_ws('|',
  (to_regtype('public.sku_classification') is not null)::text,
  (not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'egg_pre_warming' and column_name = 'void'
  ))::text,
  (exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'status_id' and is_nullable = 'YES'
  ))::text,
  (exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tbl_placement' and column_name = 'building_id' and is_nullable = 'YES'
  ))::text,
  (exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tbl_placement' and column_name = 'pen_id' and is_nullable = 'YES'
  ))::text,
  (exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'trg_post_inventory_from_chick_grading'
      and position('session_replication_role' in pg_get_functiondef(p.oid)) > 0
  ))::text,
  (not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'egg_pre_warming'
      and policyname = 'Users can select egg_pre_warming by farm'
  ))::text,
  (exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'i_warehouse'
      and column_name = 'warehouse_type'
      and column_default is null
  ))::text
);
"@
    $verificationResult = Invoke-ScalarQuery -PsqlPath $psqlPath -Query $verificationQuery -Description 'Post-apply structural verification'
    if ($verificationResult -ne 'true|true|true|true|true|true|true|true') {
        throw "Migration committed, but post-apply structural verification returned unexpected results: $verificationResult"
    }

    $unvalidatedConstraintCount = Invoke-ScalarQuery -PsqlPath $psqlPath -Query @"
select count(*)
from pg_constraint c
join pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public' and not c.convalidated;
"@ -Description 'Deferred-constraint count'

    Write-Host ''
    Write-Host 'Structural migration committed successfully to fms-dev.' -ForegroundColor Green
    Write-Host 'Post-apply structural checks passed.' -ForegroundColor Green
    Write-Host "Unvalidated public constraints requiring later cleanup: $unvalidatedConstraintCount" -ForegroundColor Yellow
    Write-Host 'RLS definitions remain deferred for manual configuration.' -ForegroundColor Yellow
}
finally {
    foreach ($name in $previousPgEnvironment.Keys) {
        if ($null -eq $previousPgEnvironment[$name]) {
            Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        }
        else {
            Set-Item -Path "Env:$name" -Value $previousPgEnvironment[$name]
        }
    }
    $connection.Password = $null
}
