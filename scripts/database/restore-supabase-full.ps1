<#
.SYNOPSIS
Restores a Docker-free Supabase logical backup set into an empty fms-dev project.

.DESCRIPTION
Validates the backup checksums, verifies the target project reference, refuses
the source fms project, confirms the target contains no Auth users or public
tables, and applies roles.sql, schema.sql, and data.sql in one transaction.

The target connection string is requested as a SecureString and is not stored
in PowerShell history. This script is intentionally limited to an empty target;
it will not merge with or clean an existing database.

.PARAMETER BackupDirectory
Directory containing roles.sql, schema.sql, data.sql, manifest.txt, and
checksums.txt.

.EXAMPLE
powershell.exe -ExecutionPolicy Bypass -File .\scripts\database\restore-supabase-full.ps1
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$BackupDirectory = (Join-Path $env:USERPROFILE 'Documents\SupabaseBackups\fms-full-backup')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$requiredFileNames = @(
    'roles.sql',
    'schema.sql',
    'data.sql',
    'manifest.txt',
    'checksums.txt'
)

function Resolve-RequiredCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required PostgreSQL command '$Name' was not found in PATH."
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
        throw 'Use a postgresql:// database URI, not the https:// Supabase project URL.'
    }

    $userInfoParts = $uri.UserInfo.Split(':', 2)
    if ($userInfoParts.Count -ne 2) {
        throw 'The PostgreSQL URI must contain both a username and password.'
    }

    $databaseName = $uri.AbsolutePath.Trim('/')
    if ([string]::IsNullOrWhiteSpace($databaseName)) {
        $databaseName = 'postgres'
    }

    $databaseUser = [Uri]::UnescapeDataString($userInfoParts[0])
    $projectRef = $null
    if ($databaseUser -match '^postgres\.([a-z0-9]+)$') {
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

function Get-ManifestValue {
    param(
        [Parameter(Mandatory)][string[]]$ManifestLines,
        [Parameter(Mandatory)][string]$Name
    )

    $prefix = "$Name`:"
    $line = $ManifestLines | Where-Object { $_.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Substring($prefix.Length).Trim()
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
$resolvedBackupDirectory = [IO.Path]::GetFullPath($BackupDirectory)
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$disableAlwaysTriggersPath = Join-Path $scriptDirectory 'restore-disable-always-triggers.sql'
$enableAlwaysTriggersPath = Join-Path $scriptDirectory 'restore-enable-always-triggers.sql'

foreach ($helperPath in @($disableAlwaysTriggersPath, $enableAlwaysTriggersPath)) {
    if (-not (Test-Path -LiteralPath $helperPath -PathType Leaf)) {
        throw "Required restore helper is missing: $helperPath"
    }
}

foreach ($fileName in $requiredFileNames) {
    $filePath = Join-Path $resolvedBackupDirectory $fileName
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        throw "Required backup file is missing: $filePath"
    }
    if ((Get-Item -LiteralPath $filePath).Length -eq 0) {
        throw "Required backup file is empty: $filePath"
    }
}

$checksumsPath = Join-Path $resolvedBackupDirectory 'checksums.txt'
Write-Host 'Verifying backup checksums' -ForegroundColor Cyan
$checksumEntries = Get-Content -LiteralPath $checksumsPath
if (-not $checksumEntries) {
    throw 'checksums.txt contains no checksum entries.'
}

foreach ($checksumEntry in $checksumEntries) {
    if ($checksumEntry -notmatch '^([0-9a-fA-F]{64})  (.+)$') {
        throw "Invalid checksum entry: $checksumEntry"
    }

    $expectedHash = $matches[1].ToLowerInvariant()
    $fileName = $matches[2]
    if ($fileName -notin @('roles.sql', 'schema.sql', 'data.sql', 'manifest.txt')) {
        throw "Unexpected file in checksums.txt: $fileName"
    }

    $filePath = Join-Path $resolvedBackupDirectory $fileName
    $actualHash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
        throw "Checksum mismatch for $fileName. The backup may be incomplete or modified."
    }
}

$manifestPath = Join-Path $resolvedBackupDirectory 'manifest.txt'
$manifestLines = @(
    Get-Content -LiteralPath $manifestPath |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
$sourceUser = Get-ManifestValue -ManifestLines $manifestLines -Name 'Source user'
$sourceProjectRef = $null
if ($sourceUser -match '^postgres\.([a-z0-9]+)$') {
    $sourceProjectRef = $matches[1]
}

$projectReferenceInput = (Read-Host 'Enter the fms-dev project reference or non-secret database hostname').Trim().ToLowerInvariant()
if ($projectReferenceInput -match '^(?:db\.)?([a-z0-9]+)\.supabase\.co(?::\d+)?(?:/.*)?$') {
    $expectedProjectRef = $matches[1]
}
elseif ($projectReferenceInput -match '^[a-z0-9]+$') {
    $expectedProjectRef = $projectReferenceInput
}
else {
    throw 'Enter only the project reference (example: abcdefghijklmnopqrst) or a hostname such as db.abcdefghijklmnopqrst.supabase.co:5432/postgres. Do not enter a URI containing a password at this prompt.'
}

$secureConnectionString = Read-Host 'Paste the fms-dev PostgreSQL Session Pooler URI' -AsSecureString
$plainConnectionString = ConvertFrom-SecureStringToPlainText $secureConnectionString
$connection = Parse-PostgresUri $plainConnectionString
$plainConnectionString = $null
$secureConnectionString.Dispose()

if (-not $connection.ProjectRef) {
    throw "Could not read a project reference from database user '$($connection.User)'. Use the Session Pooler URI with username postgres.PROJECT_REF."
}
if ($connection.ProjectRef -ne $expectedProjectRef) {
    throw "Connection project reference '$($connection.ProjectRef)' does not match expected fms-dev reference '$expectedProjectRef'."
}
if ($sourceProjectRef -and $connection.ProjectRef -eq $sourceProjectRef) {
    throw 'Refusing restore: the target connection points to the source fms project recorded in manifest.txt.'
}

$previousPgEnvironment = @{
    PGHOST = $env:PGHOST
    PGPORT = $env:PGPORT
    PGUSER = $env:PGUSER
    PGPASSWORD = $env:PGPASSWORD
    PGDATABASE = $env:PGDATABASE
}

try {
    $env:PGHOST = $connection.Host
    $env:PGPORT = [string]$connection.Port
    $env:PGUSER = $connection.User
    $env:PGPASSWORD = $connection.Password
    $env:PGDATABASE = $connection.Database

    Write-Host 'Validating the fms-dev database connection' -ForegroundColor Cyan
    $connectedUser = Invoke-ScalarQuery -PsqlPath $psqlPath -Query 'select current_user;' -Description 'Target connection validation'
    Write-Host "Connected to fms-dev project ref: $($connection.ProjectRef) as $connectedUser"

    $publicTableCount = [int](Invoke-ScalarQuery -PsqlPath $psqlPath -Query "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';" -Description 'Public table preflight')
    $authUserCount = [int](Invoke-ScalarQuery -PsqlPath $psqlPath -Query 'select count(*) from auth.users;' -Description 'Auth user preflight')
    $storageObjectCount = [int](Invoke-ScalarQuery -PsqlPath $psqlPath -Query 'select count(*) from storage.objects;' -Description 'Storage metadata preflight')

    if ($publicTableCount -ne 0 -or $authUserCount -ne 0 -or $storageObjectCount -ne 0) {
        throw "fms-dev is not empty. Found public tables=$publicTableCount, Auth users=$authUserCount, Storage objects=$storageObjectCount. This script will not merge or delete existing target data."
    }

    Write-Host ''
    Write-Host 'Restore preflight passed.' -ForegroundColor Green
    Write-Host "Source project ref: $sourceProjectRef"
    Write-Host "Target fms-dev project ref: $($connection.ProjectRef)"
    Write-Host 'Target public tables: 0; Auth users: 0; Storage objects: 0'
    Write-Host ''

    $requiredConfirmation = "RESTORE $($connection.ProjectRef)"
    $confirmation = Read-Host "Type '$requiredConfirmation' to restore the full backup into fms-dev"
    if ($confirmation -cne $requiredConfirmation) {
        throw 'Restore cancelled because the confirmation text did not match.'
    }

    $rolesPath = Join-Path $resolvedBackupDirectory 'roles.sql'
    $schemaPath = Join-Path $resolvedBackupDirectory 'schema.sql'
    $dataPath = Join-Path $resolvedBackupDirectory 'data.sql'

    Write-Host 'Restoring roles, schema, Auth data, Storage metadata, and application records in one transaction' -ForegroundColor Cyan
    Write-Host 'Temporarily disabling public ENABLE ALWAYS triggers while saved rows are copied' -ForegroundColor Cyan
    & $psqlPath @(
        '--no-psqlrc',
        '--single-transaction',
        '--set=ON_ERROR_STOP=1',
        "--file=$rolesPath",
        '--command=CREATE SCHEMA IF NOT EXISTS public;',
        "--file=$schemaPath",
        "--file=$disableAlwaysTriggersPath",
        "--file=$dataPath",
        "--file=$enableAlwaysTriggersPath"
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Full restore failed with exit code $LASTEXITCODE. The transaction was rolled back."
    }

    & $psqlPath --no-psqlrc --set=ON_ERROR_STOP=1 '--command=NOTIFY pgrst, ''reload schema'';'
    if ($LASTEXITCODE -ne 0) {
        throw 'The database restored, but the PostgREST schema-cache reload failed.'
    }

    $restoredPublicTableCount = Invoke-ScalarQuery -PsqlPath $psqlPath -Query "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';" -Description 'Restored public table verification'
    $restoredAuthUserCount = Invoke-ScalarQuery -PsqlPath $psqlPath -Query 'select count(*) from auth.users;' -Description 'Restored Auth user verification'
    $restoredStorageObjectCount = Invoke-ScalarQuery -PsqlPath $psqlPath -Query 'select count(*) from storage.objects;' -Description 'Restored Storage metadata verification'

    Write-Host ''
    Write-Host 'Full fms backup restored successfully into fms-dev.' -ForegroundColor Green
    Write-Host "Public tables: $restoredPublicTableCount"
    Write-Host "Auth users: $restoredAuthUserCount"
    Write-Host "Storage metadata objects: $restoredStorageObjectCount"
}
finally {
    $env:PGHOST = $previousPgEnvironment.PGHOST
    $env:PGPORT = $previousPgEnvironment.PGPORT
    $env:PGUSER = $previousPgEnvironment.PGUSER
    $env:PGPASSWORD = $previousPgEnvironment.PGPASSWORD
    $env:PGDATABASE = $previousPgEnvironment.PGDATABASE

    $connection.Password = $null
}
