<#
.SYNOPSIS
Generates a Docker-free public-schema migration from DEV to fms-dev.

.DESCRIPTION
Uses migra to compare the current fms-dev public schema with the desired DEV
public schema. It writes SQL that would migrate fms-dev toward DEV. No table
records are read into the output and the generated SQL is never applied by
this script.

Both database URIs are requested as SecureString values so passwords are not
stored in PowerShell history. A temporary pgpass file keeps passwords out of
migra's process arguments.

Migra is run in its default safe mode. If destructive statements would be
required, generation stops rather than enabling --unsafe.

.PARAMETER OutputFile
Destination for the generated migration. An existing file is never
overwritten.

.PARAMETER IncludeDestructiveStatements
Allows migra to include DROP and other potentially destructive statements in
the review file. This still never applies the SQL. A stronger confirmation is
required and the output is marked as unapproved.

.EXAMPLE
powershell.exe -ExecutionPolicy Bypass -File .\scripts\database\generate-supabase-schema-diff.ps1
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$OutputFile = (Join-Path $env:USERPROFILE 'Documents\SupabaseBackups\dev-to-fms-dev-schema.sql'),

    [Parameter()]
    [switch]$IncludeDestructiveStatements
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

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
    param(
        [Parameter(Mandatory)][string]$ConnectionString,
        [Parameter(Mandatory)][string]$Label
    )

    try {
        $uri = [Uri]$ConnectionString
    }
    catch {
        throw "$Label is not a valid PostgreSQL URI."
    }

    if ($uri.Scheme -notin @('postgres', 'postgresql')) {
        throw "$Label must use postgresql://, not the https:// Supabase API URL."
    }

    $userInfoParts = $uri.UserInfo.Split(':', 2)
    if ($userInfoParts.Count -ne 2) {
        throw "$Label must contain both a username and password."
    }

    $databaseUser = [Uri]::UnescapeDataString($userInfoParts[0])
    $databasePassword = [Uri]::UnescapeDataString($userInfoParts[1])
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
        Password = $databasePassword
        Database = $databaseName
        ProjectRef = $projectRef
    }
}

function Resolve-MigraCommand {
    $command = Get-Command 'migra.exe' -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $pythonCommand = Get-Command 'python.exe' -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw 'python.exe was not found in PATH.'
    }

    $userSite = (& $pythonCommand.Source -m site --user-site).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($userSite)) {
        throw 'Could not determine the Python user site-packages directory.'
    }

    $pythonVersionDirectory = Split-Path -Parent $userSite
    $candidate = Join-Path $pythonVersionDirectory 'Scripts\migra.exe'
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw @"
migra.exe was not found. Install the required packages with:

python.exe -m pip install --user migra psycopg2-binary "setuptools<81"
"@
    }

    return $candidate
}

function ConvertTo-PgPassField {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Value)

    return $Value.Replace('\', '\\').Replace(':', '\:')
}

function ConvertTo-PasswordlessPostgresUri {
    param([Parameter(Mandatory)]$Connection)

    $escapedUser = [Uri]::EscapeDataString($Connection.User)
    $escapedDatabase = [Uri]::EscapeDataString($Connection.Database)
    return 'postgresql://{0}@{1}:{2}/{3}?sslmode=require' -f @(
        $escapedUser,
        $Connection.Host,
        $Connection.Port,
        $escapedDatabase
    )
}

function New-PgPassLine {
    param([Parameter(Mandatory)]$Connection)

    return '{0}:{1}:{2}:{3}:{4}' -f @(
        (ConvertTo-PgPassField $Connection.Host),
        $Connection.Port,
        (ConvertTo-PgPassField $Connection.Database),
        (ConvertTo-PgPassField $Connection.User),
        (ConvertTo-PgPassField $Connection.Password)
    )
}

function Invoke-MigraComparison {
    param(
        [Parameter(Mandatory)][string]$CommandPath,
        [Parameter(Mandatory)][string]$CurrentDatabaseUri,
        [Parameter(Mandatory)][string]$DesiredDatabaseUri,
        [Parameter(Mandatory)][bool]$AllowDestructiveStatements
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $CommandPath
    $unsafeArgument = if ($AllowDestructiveStatements) { '--unsafe ' } else { '' }
    $startInfo.Arguments = '{0}--schema public --with-privileges "{1}" "{2}"' -f @(
        $unsafeArgument,
        $CurrentDatabaseUri.Replace('"', '\"'),
        $DesiredDatabaseUri.Replace('"', '\"')
    )
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardOutputEncoding = [Text.Encoding]::UTF8
    $startInfo.StandardErrorEncoding = [Text.Encoding]::UTF8
    $startInfo.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
    $startInfo.EnvironmentVariables['PYTHONUTF8'] = '1'
    $startInfo.EnvironmentVariables['PYTHONWARNINGS'] = 'ignore::UserWarning'

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo

    try {
        if (-not $process.Start()) {
            throw 'Could not start migra.exe.'
        }

        $standardOutputTask = $process.StandardOutput.ReadToEndAsync()
        $standardErrorTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()

        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StandardOutput = $standardOutputTask.Result
            StandardError = $standardErrorTask.Result
        }
    }
    finally {
        $process.Dispose()
    }
}

$migraPath = Resolve-MigraCommand
$resolvedOutputFile = [IO.Path]::GetFullPath($OutputFile)
$outputDirectory = Split-Path -Parent $resolvedOutputFile

if (Test-Path -LiteralPath $resolvedOutputFile) {
    throw "Output file already exists. Move it or choose another -OutputFile: $resolvedOutputFile"
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

Write-Host 'This creates SQL only. It does not copy data or modify either database.' -ForegroundColor Cyan
Write-Host 'Direction: current fms-dev schema -> desired DEV schema' -ForegroundColor Cyan
if ($IncludeDestructiveStatements) {
    Write-Host 'REVIEW MODE: potentially destructive SQL will be included but NOT applied.' -ForegroundColor Red
}

$targetSecureUri = Read-Host 'Paste the CURRENT fms-dev PostgreSQL Session Pooler URI' -AsSecureString
$targetPlainUri = ConvertFrom-SecureStringToPlainText $targetSecureUri
$targetConnection = Parse-PostgresUri -ConnectionString $targetPlainUri -Label 'The fms-dev URI'
$targetPlainUri = $null
$targetSecureUri.Dispose()

$sourceSecureUri = Read-Host 'Paste the DESIRED original DEV PostgreSQL Session Pooler URI' -AsSecureString
$sourcePlainUri = ConvertFrom-SecureStringToPlainText $sourceSecureUri
$sourceConnection = Parse-PostgresUri -ConnectionString $sourcePlainUri -Label 'The DEV URI'
$sourcePlainUri = $null
$sourceSecureUri.Dispose()

if ($targetConnection.Host -eq $sourceConnection.Host -and
    $targetConnection.Port -eq $sourceConnection.Port -and
    $targetConnection.User -eq $sourceConnection.User -and
    $targetConnection.Database -eq $sourceConnection.Database) {
    throw 'The fms-dev and DEV URIs point to the same database.'
}

$targetIdentity = if ($targetConnection.ProjectRef) { $targetConnection.ProjectRef } else { $targetConnection.User }
$sourceIdentity = if ($sourceConnection.ProjectRef) { $sourceConnection.ProjectRef } else { $sourceConnection.User }

Write-Host "Current database to migrate: $targetIdentity" -ForegroundColor Yellow
Write-Host "Desired schema source:       $sourceIdentity" -ForegroundColor Yellow
$requiredConfirmation = if ($IncludeDestructiveStatements) {
    "GENERATE UNSAFE $targetIdentity"
}
else {
    "GENERATE $targetIdentity"
}
$confirmation = Read-Host "Type $requiredConfirmation to continue"
if ($confirmation -cne $requiredConfirmation) {
    throw 'Confirmation did not match. No schema difference was generated.'
}

$temporaryPgPassFile = [IO.Path]::GetTempFileName()
$previousPgPassFile = $env:PGPASSFILE

try {
    $pgPassLines = @(
        New-PgPassLine $targetConnection
        New-PgPassLine $sourceConnection
    )
    [IO.File]::WriteAllLines($temporaryPgPassFile, $pgPassLines, $utf8NoBom)
    $env:PGPASSFILE = $temporaryPgPassFile

    $targetUri = ConvertTo-PasswordlessPostgresUri $targetConnection
    $sourceUri = ConvertTo-PasswordlessPostgresUri $sourceConnection

    Write-Host 'Comparing only the public schema; no table records are included' -ForegroundColor Cyan
    $migraResult = Invoke-MigraComparison -CommandPath $migraPath -CurrentDatabaseUri $targetUri -DesiredDatabaseUri $sourceUri -AllowDestructiveStatements $IncludeDestructiveStatements.IsPresent
    $migraExitCode = $migraResult.ExitCode
    $migrationSql = $migraResult.StandardOutput
    $errorLines = @($migraResult.StandardError -split "`r?`n")

    if ($migraExitCode -eq 0) {
        Write-Host 'The public schemas already match. No file was created.' -ForegroundColor Green
        return
    }

    if ($migraExitCode -eq 3) {
        $usefulErrors = @(
            $errorLines | Where-Object {
                $_ -notmatch 'pkg_resources is deprecated' -and
                $_ -notmatch '^\s*from pkg_resources import '
            }
        )
        if ($usefulErrors) {
            $usefulErrors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        }
        throw 'Migra detected destructive statements and refused to generate them. --unsafe was not used.'
    }

    if ($migraExitCode -ne 2) {
        if ($errorLines) {
            $errorLines | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        }
        throw "Schema comparison failed with migra exit code $migraExitCode."
    }

    if ([string]::IsNullOrWhiteSpace($migrationSql)) {
        throw 'Migra reported differences but returned no SQL.'
    }

    $outputPreamble = if ($IncludeDestructiveStatements) {
        @"
-- REVIEW REQUIRED: generated with migra --unsafe.
-- THIS FILE MAY CONTAIN DESTRUCTIVE STATEMENTS AND IS NOT APPROVED FOR EXECUTION.
-- Direction: current fms-dev public schema -> desired DEV public schema.
-- No table records are included by the comparison.

"@
    }
    else {
        ''
    }

    [IO.File]::WriteAllText($resolvedOutputFile, "$outputPreamble$migrationSql", $utf8NoBom)

    Write-Host ''
    Write-Host 'Schema difference generated successfully. It has NOT been applied.' -ForegroundColor Green
    if ($IncludeDestructiveStatements) {
        Write-Host 'The file contains unreviewed destructive statements. Do not execute it.' -ForegroundColor Red
    }
    Write-Host "Output: $resolvedOutputFile" -ForegroundColor Green
    Get-Item -LiteralPath $resolvedOutputFile | Select-Object Name, Length, LastWriteTime
}
finally {
    $env:PGPASSFILE = $previousPgPassFile
    $targetConnection.Password = $null
    $sourceConnection.Password = $null

    foreach ($temporaryFile in @($temporaryPgPassFile)) {
        if (Test-Path -LiteralPath $temporaryFile) {
            Remove-Item -LiteralPath $temporaryFile -Force
        }
    }
}
