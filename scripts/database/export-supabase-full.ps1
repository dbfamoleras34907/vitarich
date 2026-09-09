<#
.SYNOPSIS
Creates a Docker-free logical backup set for a hosted Supabase database.

.DESCRIPTION
Uses native pg_dump, pg_dumpall, and psql binaries to reproduce the relevant
filtering performed by `supabase db dump`. The generated backup set consists of
roles.sql, schema.sql, data.sql, manifest.txt, and checksums.txt.

The connection string is requested as a SecureString so it is not stored in
PowerShell history. It must be a PostgreSQL Session Pooler or direct URI, not
the https:// project API URL.

.PARAMETER OutputDirectory
Destination for the backup set. The directory must not already contain any of
the five generated files.

.EXAMPLE
powershell.exe -ExecutionPolicy Bypass -File .\scripts\database\export-supabase-full.ps1
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$OutputDirectory = (Join-Path $env:USERPROFILE 'Documents\SupabaseBackups\fms-full-backup')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$generatedFileNames = @(
    'roles.sql',
    'schema.sql',
    'data.sql',
    'manifest.txt',
    'checksums.txt'
)

$reservedRolePattern = '(anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)'
$safeRoleSettingPattern = '(pgaudit.*|pgrst.*|session_replication_role|statement_timeout|track_io_timing)'
$schemaExclusions = 'information_schema|pg_*|_analytics|_realtime|_supavisor|auth|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault'
$dataExclusions = 'information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor'
$internalAclSchemaPattern = '(information_schema|pg_.*|_analytics|_realtime|_supavisor|auth|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_.*|_timescaledb_.*|topology|vault)'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Resolve-RequiredCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required PostgreSQL command '$Name' was not found in PATH."
    }

    return $command.Source
}

function Invoke-PostgresCommand {
    param(
        [Parameter(Mandatory)][string]$CommandPath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$Description
    )

    Write-Host $Description -ForegroundColor Cyan
    & $CommandPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
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

    return [pscustomobject]@{
        Host = $uri.Host
        Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
        User = [Uri]::UnescapeDataString($userInfoParts[0])
        Password = [Uri]::UnescapeDataString($userInfoParts[1])
        Database = $databaseName
    }
}

function Convert-RolesDump {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputPath
    )

    $result = New-Object System.Collections.Generic.List[string]
    $previousLine = $null

    foreach ($sourceLine in [IO.File]::ReadAllLines($InputPath)) {
        $line = $sourceLine

        if ($line -match '^\\(un)?restrict ') { continue }
        if ($line -match "^CREATE ROLE `"$reservedRolePattern`"") { continue }

        if ($line -match "^ALTER ROLE `"$reservedRolePattern`"") {
            if ($line -notmatch " SET `"$safeRoleSettingPattern`" ") { continue }
        }

        $line = $line -replace ' (NOSUPERUSER|NOREPLICATION)', ''

        if ($line -match "^GRANT `".*`" TO `"$reservedRolePattern`"") { continue }
        if ($line -match '^--') { continue }

        if ($line -ne $previousLine) {
            $result.Add($line)
            $previousLine = $line
        }
    }

    $result.Add('RESET ALL;')
    [IO.File]::WriteAllLines($OutputPath, $result, $utf8NoBom)
}

function Convert-SchemaDump {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputPath
    )

    $result = New-Object System.Collections.Generic.List[string]

    foreach ($sourceLine in [IO.File]::ReadAllLines($InputPath)) {
        $line = $sourceLine

        if ($line -match '^\\(un)?restrict ') { continue }
        if ($line -match '^CREATE PUBLICATION "supabase_realtime') { continue }
        if ($line -match '^CREATE EVENT TRIGGER ') { continue }
        if ($line -match '^\s+WHEN TAG IN ') { continue }
        if ($line -match '^\s+EXECUTE FUNCTION ') { continue }
        if ($line -match '^ALTER EVENT TRIGGER ') { continue }
        if ($line -match '^ALTER PUBLICATION "supabase_realtime_') { continue }
        if ($line -match '^ALTER FOREIGN DATA WRAPPER .+ OWNER TO ') { continue }
        if ($line -match '^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"') { continue }
        if ($line -match '^GRANT ALL ON FOREIGN DATA WRAPPER .+ TO "postgres" WITH GRANT OPTION') { continue }
        if ($line -match "^(GRANT|REVOKE) .+ ON .+ `"$internalAclSchemaPattern`"") { continue }
        if ($line -match '^COMMENT ON EXTENSION ') { continue }
        if ($line -match '^CREATE POLICY "cron_job_') { continue }
        if ($line -match '^ALTER TABLE "cron"') { continue }
        if ($line -eq 'SET transaction_timeout = 0;') { continue }
        if ($line -match '^--') { continue }

        $line = $line -replace '^CREATE SCHEMA "', 'CREATE SCHEMA IF NOT EXISTS "'
        $line = $line -replace '^CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "'
        $line = $line -replace '^CREATE SEQUENCE "', 'CREATE SEQUENCE IF NOT EXISTS "'
        $line = $line -replace '^CREATE VIEW "', 'CREATE OR REPLACE VIEW "'
        $line = $line -replace '^CREATE FUNCTION "', 'CREATE OR REPLACE FUNCTION "'
        $line = $line -replace '^CREATE TRIGGER "', 'CREATE OR REPLACE TRIGGER "'
        $line = $line -replace '^(CREATE EXTENSION IF NOT EXISTS "(?:pg_tle|pgsodium|pgmq)").*$', '$1;'

        $result.Add($line)
    }

    [IO.File]::WriteAllLines($OutputPath, $result, $utf8NoBom)
}

function Convert-DataDump {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputPath
    )

    $result = New-Object System.Collections.Generic.List[string]
    $result.Add('SET session_replication_role = replica;')
    $result.Add('')

    foreach ($line in [IO.File]::ReadAllLines($InputPath)) {
        if ($line -match '^\\(un)?restrict ') { continue }
        $result.Add($line)
    }

    $result.Add('')
    $result.Add('RESET ALL;')
    [IO.File]::WriteAllLines($OutputPath, $result, $utf8NoBom)
}

$pgDumpPath = Resolve-RequiredCommand 'pg_dump.exe'
$pgDumpAllPath = Resolve-RequiredCommand 'pg_dumpall.exe'
$psqlPath = Resolve-RequiredCommand 'psql.exe'

$resolvedOutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$userProfilePath = [IO.Path]::GetFullPath($env:USERPROFILE)
if (-not $resolvedOutputDirectory.StartsWith($userProfilePath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "For safety, OutputDirectory must be inside your user profile: $userProfilePath"
}

New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

$existingGeneratedFiles = $generatedFileNames | ForEach-Object {
    Join-Path $resolvedOutputDirectory $_
} | Where-Object { Test-Path -LiteralPath $_ }

if ($existingGeneratedFiles) {
    throw "Backup files already exist in '$resolvedOutputDirectory'. Move that backup or choose a new -OutputDirectory; nothing was overwritten."
}

$secureConnectionString = Read-Host 'Paste the fms PostgreSQL Session Pooler URI' -AsSecureString
$plainConnectionString = ConvertFrom-SecureStringToPlainText $secureConnectionString
$connection = Parse-PostgresUri $plainConnectionString
$plainConnectionString = $null
$secureConnectionString.Dispose()

$previousPgEnvironment = @{
    PGHOST = $env:PGHOST
    PGPORT = $env:PGPORT
    PGUSER = $env:PGUSER
    PGPASSWORD = $env:PGPASSWORD
    PGDATABASE = $env:PGDATABASE
}

$temporaryDirectory = Join-Path $resolvedOutputDirectory '.working'
if (Test-Path -LiteralPath $temporaryDirectory) {
    throw "Temporary directory already exists: $temporaryDirectory"
}
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

$rolesRawPath = Join-Path $temporaryDirectory 'roles.raw.sql'
$schemaRawPath = Join-Path $temporaryDirectory 'schema.raw.sql'
$dataRawPath = Join-Path $temporaryDirectory 'data.raw.sql'
$rolesPath = Join-Path $resolvedOutputDirectory 'roles.sql'
$schemaPath = Join-Path $resolvedOutputDirectory 'schema.sql'
$dataPath = Join-Path $resolvedOutputDirectory 'data.sql'
$manifestPath = Join-Path $resolvedOutputDirectory 'manifest.txt'
$checksumsPath = Join-Path $resolvedOutputDirectory 'checksums.txt'

try {
    $env:PGHOST = $connection.Host
    $env:PGPORT = [string]$connection.Port
    $env:PGUSER = $connection.User
    $env:PGPASSWORD = $connection.Password
    $env:PGDATABASE = $connection.Database

    Invoke-PostgresCommand -CommandPath $psqlPath -Arguments @(
        '--no-psqlrc', '--tuples-only', '--no-align', '--command=select 1;'
    ) -Description 'Validating the fms database connection'

    Invoke-PostgresCommand -CommandPath $pgDumpAllPath -Arguments @(
        '--roles-only',
        '--role=postgres',
        '--quote-all-identifiers',
        '--no-role-passwords',
        '--no-comments',
        "--file=$rolesRawPath"
    ) -Description 'Exporting database roles'

    Invoke-PostgresCommand -CommandPath $pgDumpPath -Arguments @(
        '--schema-only',
        '--quote-all-identifiers',
        '--role=postgres',
        "--exclude-schema=$schemaExclusions",
        "--file=$schemaRawPath"
    ) -Description 'Exporting database schema'

    Invoke-PostgresCommand -CommandPath $pgDumpPath -Arguments @(
        '--data-only',
        '--quote-all-identifiers',
        '--role=postgres',
        "--exclude-schema=$dataExclusions",
        '--exclude-table=auth.schema_migrations',
        '--exclude-table=storage.migrations',
        '--exclude-table=supabase_functions.migrations',
        '--exclude-table=storage.buckets_vectors',
        '--exclude-table=storage.vector_indexes',
        '--schema=*',
        "--file=$dataRawPath"
    ) -Description 'Exporting database records, including Auth and Storage metadata'

    Write-Host 'Applying Supabase-compatible filters' -ForegroundColor Cyan
    Convert-RolesDump -InputPath $rolesRawPath -OutputPath $rolesPath
    Convert-SchemaDump -InputPath $schemaRawPath -OutputPath $schemaPath
    Convert-DataDump -InputPath $dataRawPath -OutputPath $dataPath

    $postgresVersion = (& $psqlPath --no-psqlrc --tuples-only --no-align --command='show server_version;').Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not read the source PostgreSQL version.'
    }

    $tableCount = (& $psqlPath --no-psqlrc --tuples-only --no-align --command="select count(*) from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema');").Trim()
    if ($LASTEXITCODE -ne 0) { $tableCount = 'unavailable' }

    $authUserCount = (& $psqlPath --no-psqlrc --tuples-only --no-align --command='select count(*) from auth.users;').Trim()
    if ($LASTEXITCODE -ne 0) { $authUserCount = 'unavailable' }

    $storageObjectCount = (& $psqlPath --no-psqlrc --tuples-only --no-align --command='select count(*) from storage.objects;').Trim()
    if ($LASTEXITCODE -ne 0) { $storageObjectCount = 'unavailable' }

    $manifestLines = @(
        'Supabase logical backup manifest',
        "Created UTC: $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))",
        "Source host: $($connection.Host)",
        "Source port: $($connection.Port)",
        "Source database: $($connection.Database)",
        "Source user: $($connection.User)",
        "PostgreSQL server version: $postgresVersion",
        "Non-system table count: $tableCount",
        "Auth user count: $authUserCount",
        "Storage metadata object count: $storageObjectCount",
        '',
        'Files:',
        '  roles.sql   - filtered custom roles and safe role settings',
        '  schema.sql  - application schemas; platform-managed schemas excluded',
        '  data.sql    - records including Auth and Storage metadata',
        '  checksums.txt - SHA256 integrity checks',
        '',
        'Important:',
        '  This backup does not contain the binary files stored in Storage buckets.',
        '  It does not contain Edge Functions, project API keys, secrets, or Dashboard configuration.',
        '  Restore only into the intended disposable fms-dev project using the reviewed restore procedure.'
    )
    [IO.File]::WriteAllLines($manifestPath, $manifestLines, $utf8NoBom)

    $checksumLines = @('roles.sql', 'schema.sql', 'data.sql', 'manifest.txt') | ForEach-Object {
        $filePath = Join-Path $resolvedOutputDirectory $_
        $hash = Get-FileHash -LiteralPath $filePath -Algorithm SHA256
        "$($hash.Hash.ToLowerInvariant())  $_"
    }
    [IO.File]::WriteAllLines($checksumsPath, $checksumLines, $utf8NoBom)

    foreach ($fileName in $generatedFileNames) {
        $filePath = Join-Path $resolvedOutputDirectory $fileName
        $file = Get-Item -LiteralPath $filePath
        if ($file.Length -eq 0) {
            throw "Generated file is empty: $filePath"
        }
    }

    Write-Host ''
    Write-Host 'Backup completed successfully:' -ForegroundColor Green
    Get-ChildItem -LiteralPath $resolvedOutputDirectory -File |
        Where-Object { $_.Name -in $generatedFileNames } |
        Select-Object Name, Length, LastWriteTime
}
finally {
    $env:PGHOST = $previousPgEnvironment.PGHOST
    $env:PGPORT = $previousPgEnvironment.PGPORT
    $env:PGUSER = $previousPgEnvironment.PGUSER
    $env:PGPASSWORD = $previousPgEnvironment.PGPASSWORD
    $env:PGDATABASE = $previousPgEnvironment.PGDATABASE

    $connection.Password = $null

    foreach ($temporaryFile in @($rolesRawPath, $schemaRawPath, $dataRawPath)) {
        if (Test-Path -LiteralPath $temporaryFile) {
            Remove-Item -LiteralPath $temporaryFile -Force
        }
    }
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Force
    }
}
