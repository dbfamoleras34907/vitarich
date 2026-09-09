<#
.SYNOPSIS
Prepares a reviewed structural migration from a Migra comparison file.

.DESCRIPTION
Removes generated RLS policy definitions, RLS enable/disable statements,
grants, and revokes from the comparison. It drops only the legacy policy that
blocks an intentional column removal, keeps the requested destructive
structural changes, makes the three new relationship columns temporarily
nullable, preserves the Chick Grading replica-restore guard, and wraps the
result in one transaction. New CHECK and FOREIGN KEY constraints are installed
as NOT VALID so existing MAIN records are preserved for a separate audit and
backfill phase.

This script only writes another SQL file. It never connects to or modifies a
database.

.PARAMETER InputFile
Migra review file generated from current fms-dev toward desired DEV.

.PARAMETER OutputFile
Destination for the prepared structural migration. Existing files are never
overwritten.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$InputFile = (Join-Path $env:USERPROFILE 'Documents\SupabaseBackups\dev-to-fms-dev-migra.sql'),

    [Parameter()]
    [string]$OutputFile = (Join-Path $env:USERPROFILE 'Documents\SupabaseBackups\dev-to-fms-dev-structural.sql')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedInputFile = [IO.Path]::GetFullPath($InputFile)
$resolvedOutputFile = [IO.Path]::GetFullPath($OutputFile)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath $resolvedInputFile -PathType Leaf)) {
    throw "Migra input file was not found: $resolvedInputFile"
}
if (Test-Path -LiteralPath $resolvedOutputFile) {
    throw "Output file already exists. Move it or choose another -OutputFile: $resolvedOutputFile"
}

$sql = [IO.File]::ReadAllText($resolvedInputFile)
if ($sql -notmatch '(?m)^-- REVIEW REQUIRED: generated with migra --unsafe\.$') {
    throw 'The input is not the expected guarded Migra review file.'
}
if ($sql -notmatch '(?m)^-- Direction: current fms-dev public schema -> desired DEV public schema\.$') {
    throw 'The input does not declare the expected fms-dev to DEV direction.'
}

$nullableReplacements = [ordered]@{
    'alter table "public"."tasks" add column "status_id" bigint not null;' =
        'alter table "public"."tasks" add column "status_id" bigint;'
    'alter table "public"."tbl_placement" add column "building_id" bigint not null;' =
        'alter table "public"."tbl_placement" add column "building_id" bigint;'
    'alter table "public"."tbl_placement" add column "pen_id" bigint not null;' =
        'alter table "public"."tbl_placement" add column "pen_id" bigint;'
}

foreach ($entry in $nullableReplacements.GetEnumerator()) {
    $occurrenceCount = [regex]::Matches(
        $sql,
        [regex]::Escape($entry.Key),
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    ).Count
    if ($occurrenceCount -ne 1) {
        throw "Expected exactly one statement but found $occurrenceCount`: $($entry.Key)"
    }
    $sql = $sql.Replace($entry.Key, $entry.Value)
}

# warehouse_type previously carried FMS values in MAIN, leaving it with the
# legacy default Broiler. The DEV model separates fms_type from hierarchy type,
# and the BEFORE INSERT trigger defaults a missing hierarchy type to Warehouse.
# Drop the incompatible legacy default so it cannot violate the new check.
$legacyWarehouseTypeDefault = 'alter table "public"."i_warehouse" alter column "warehouse_type" set default ''Broiler''::text;'
$legacyWarehouseTypeDefaultCount = [regex]::Matches(
    $sql,
    [regex]::Escape($legacyWarehouseTypeDefault),
    [Text.RegularExpressions.RegexOptions]::IgnoreCase
).Count
if ($legacyWarehouseTypeDefaultCount -ne 1) {
    throw "Expected exactly one legacy i_warehouse.warehouse_type default but found $legacyWarehouseTypeDefaultCount."
}
$correctedWarehouseTypeDefault = 'alter table "public"."i_warehouse" alter column "warehouse_type" drop default;'
$sql = $sql.Replace($legacyWarehouseTypeDefault, $correctedWarehouseTypeDefault)

# The accepted structural change removes egg_pre_warming.void. MAIN has one
# legacy policy whose expression references that column, so PostgreSQL cannot
# drop the column while the policy remains. Its DEV replacement is deliberately
# not imported because RLS setup is deferred for manual configuration.
$blockingPolicySourceStatement = 'drop policy "Users can select egg_pre_warming by farm" on "public"."egg_pre_warming";'
$blockingPolicySourceCount = [regex]::Matches(
    $sql,
    [regex]::Escape($blockingPolicySourceStatement),
    [Text.RegularExpressions.RegexOptions]::IgnoreCase
).Count
if ($blockingPolicySourceCount -ne 1) {
    throw "Expected exactly one blocking egg_pre_warming policy drop but found $blockingPolicySourceCount."
}
$blockingPolicyDrop = 'drop policy if exists "Users can select egg_pre_warming by farm" on "public"."egg_pre_warming";'

# fms-dev already uses an identity sequence for approval_requests.id. DEV uses
# the older serial representation with the same sequence name. Converting the
# representation adds no application capability and Migra's generated order
# attempts to create the sequence before dropping the identity that owns it.
# Keep the existing identity intact instead.
$approvalRequestIdentityStatements = @(
    'create sequence "public"."approval_requests_id_seq";',
    'alter table "public"."approval_requests" alter column "id" set default nextval(''approval_requests_id_seq''::regclass);',
    'alter table "public"."approval_requests" alter column "id" drop identity;',
    'alter sequence "public"."approval_requests_id_seq" owned by "public"."approval_requests"."id";'
)
foreach ($statement in $approvalRequestIdentityStatements) {
    $occurrenceCount = [regex]::Matches(
        $sql,
        [regex]::Escape($statement),
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    ).Count
    if ($occurrenceCount -ne 1) {
        throw "Expected exactly one approval-request identity statement but found $occurrenceCount`: $statement"
    }
    $sql = $sql.Replace($statement, '')
}

# The restored MAIN schema names 38 otherwise-identical primary keys *_pkey1,
# while DEV names them *_pkey. Dropping/recreating a primary key is unnecessary
# and fails when an unchanged foreign key still depends on it. Rename each
# constraint in place instead; PostgreSQL also renames its backing index and
# preserves every dependent foreign key. The restored schema also has a
# redundant *_pkey index occupying the desired name, so drop that index before
# renaming the real primary-key constraint.
$primaryKeyDropPattern = '(?im)^alter table "public"\."(?<table>[^"]+)" drop constraint "(?<constraint>[^"]+_pkey1)";[ \t]*\r?$'
$primaryKeyDropMatches = @([regex]::Matches($sql, $primaryKeyDropPattern))
if ($primaryKeyDropMatches.Count -ne 38) {
    throw "Expected exactly 38 *_pkey1 primary-key replacements but found $($primaryKeyDropMatches.Count)."
}

foreach ($match in $primaryKeyDropMatches) {
    $tableName = $match.Groups['table'].Value
    $oldConstraintName = $match.Groups['constraint'].Value
    $newConstraintName = $oldConstraintName.Substring(0, $oldConstraintName.Length - 1)

    $oldIndexDrop = "drop index if exists `"public`".`"$oldConstraintName`";"
    $newIndexDrop = "drop index if exists `"public`".`"$newConstraintName`";"
    $newIndexPattern = "(?im)^CREATE UNIQUE INDEX $([regex]::Escape($newConstraintName)) ON public\.$([regex]::Escape($tableName)) USING btree \([^;]+\);[ \t]*\r?$"
    $newConstraintStatement = "alter table `"public`".`"$tableName`" add constraint `"$newConstraintName`" PRIMARY KEY using index `"$newConstraintName`";"

    $oldIndexDropCount = [regex]::Matches(
        $sql,
        [regex]::Escape($oldIndexDrop),
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    ).Count
    $newIndexDropCount = [regex]::Matches(
        $sql,
        [regex]::Escape($newIndexDrop),
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    ).Count
    $newIndexCount = [regex]::Matches($sql, $newIndexPattern).Count
    $newConstraintCount = [regex]::Matches(
        $sql,
        [regex]::Escape($newConstraintStatement),
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    ).Count

    if (
        $oldIndexDropCount -ne 1 -or
        $newIndexDropCount -ne 1 -or
        $newIndexCount -ne 1 -or
        $newConstraintCount -ne 1
    ) {
        throw "Could not safely convert the primary-key replacement for public.$tableName into a rename."
    }

    $renameStatement = "alter table `"public`".`"$tableName`" rename constraint `"$oldConstraintName`" to `"$newConstraintName`";"
    $safeRenameStatements = "$newIndexDrop`r`n$renameStatement"
    $sql = $sql.Replace($oldIndexDrop, '')
    $sql = $sql.Replace($newIndexDrop, '')
    $sql = [regex]::Replace($sql, $newIndexPattern, '')
    $sql = $sql.Replace($newConstraintStatement, '')
    $sql = $sql.Replace($match.Value.TrimEnd("`r", "`n"), $safeRenameStatements)
}

# Security configuration is intentionally deferred for manual setup.
$sql = [regex]::Replace(
    $sql,
    '(?ims)^[ \t]*(?:create|alter|drop)\s+policy\b.*?;[ \t]*(?:\r?\n){0,2}',
    ''
)
$sql = [regex]::Replace(
    $sql,
    '(?im)^[ \t]*alter\s+table\b[^;]*(?:enable|disable|force|no\s+force)\s+row\s+level\s+security\s*;[ \t]*(?:\r?\n){0,2}',
    ''
)
$sql = [regex]::Replace(
    $sql,
    '(?ims)^[ \t]*(?:grant|revoke)\b.*?;[ \t]*(?:\r?\n){0,2}',
    ''
)

# Migra emits each new CHECK/FOREIGN KEY as NOT VALID and then immediately
# validates it. MAIN contains legacy rows that do not yet satisfy every DEV
# rule. Retain the constraints (which still enforce future inserts/updates),
# but defer validation of pre-existing rows to a separate cleanup phase.
$notValidConstraintPattern = '(?im)^alter table "public"\."(?<table>[^"]+)" add constraint "(?<constraint>[^"]+)" (?:FOREIGN KEY|CHECK) .*?\bnot valid(?:\s+not valid)?;[ \t]*\r?$'
$validateConstraintPattern = '(?im)^alter table "public"\."(?<table>[^"]+)" validate constraint "(?<constraint>[^"]+)";[ \t]*\r?$'
$notValidConstraintMatches = @([regex]::Matches($sql, $notValidConstraintPattern))
$validateConstraintMatches = @([regex]::Matches($sql, $validateConstraintPattern))

$notValidConstraintKeys = @{}
foreach ($match in $notValidConstraintMatches) {
    $key = "$($match.Groups['table'].Value).$($match.Groups['constraint'].Value)".ToLowerInvariant()
    if ($notValidConstraintKeys.ContainsKey($key)) {
        throw "Duplicate NOT VALID constraint generated: $key"
    }
    $notValidConstraintKeys[$key] = $true
}

foreach ($match in $validateConstraintMatches) {
    $key = "$($match.Groups['table'].Value).$($match.Groups['constraint'].Value)".ToLowerInvariant()
    if (-not $notValidConstraintKeys.ContainsKey($key)) {
        throw "Refusing to defer validation without a matching NOT VALID constraint: $key"
    }
}

if ($validateConstraintMatches.Count -ne $notValidConstraintMatches.Count) {
    throw "Expected one validation for each NOT VALID constraint; found $($validateConstraintMatches.Count) validations and $($notValidConstraintMatches.Count) constraints."
}

$sql = [regex]::Replace($sql, $validateConstraintPattern, '')

# DEV currently lacks this guard. Preserve it in the structural migration so
# future logical restores do not generate duplicate inventory postings.
$guardExpression = "current_setting('session_replication_role') = 'replica'"
if ($sql.IndexOf($guardExpression, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
    $functionStart = $sql.IndexOf(
        'CREATE OR REPLACE FUNCTION public.trg_post_inventory_from_chick_grading()',
        [StringComparison]::OrdinalIgnoreCase
    )
    if ($functionStart -lt 0) {
        throw 'Could not find the Chick Grading trigger function in the migration.'
    }

    $functionEnd = $sql.IndexOf('$function$', $functionStart + 1, [StringComparison]::OrdinalIgnoreCase)
    $functionEnd = $sql.IndexOf('$function$', $functionEnd + 1, [StringComparison]::OrdinalIgnoreCase)
    if ($functionEnd -lt 0) {
        throw 'Could not find the end of the Chick Grading trigger function.'
    }

    $beginMatch = [regex]::Match(
        $sql.Substring($functionStart, $functionEnd - $functionStart),
        '\bbegin\b',
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if (-not $beginMatch.Success) {
        throw 'Could not find the BEGIN block in the Chick Grading trigger function.'
    }

    $insertPosition = $functionStart + $beginMatch.Index + $beginMatch.Length
    $restoreGuard = @"


  -- A logical restore already contains the original inventory postings.
  if current_setting('session_replication_role') = 'replica' then
    return new;
  end if;
"@
    $sql = $sql.Insert($insertPosition, $restoreGuard)
}

$securityChecks = [ordered]@{
    Policies = '(?im)^\s*(?:create|alter|drop)\s+policy\b'
    RowLevelSecurity = '(?im)^\s*alter\s+table\b[^;]*row\s+level\s+security\s*;'
    GrantsOrRevokes = '(?im)^\s*(?:grant|revoke)\b'
}
foreach ($check in $securityChecks.GetEnumerator()) {
    if ([regex]::IsMatch($sql, $check.Value)) {
        throw "Security filtering failed; $($check.Key) statements remain."
    }
}

# Insert the one required dependency removal only after proving that every
# generated policy statement was filtered out.
$sql = "$blockingPolicyDrop`r`n`r`n$sql"
if ([regex]::Matches($sql, '(?im)^\s*(?:create|alter|drop)\s+policy\b').Count -ne 1) {
    throw 'Expected only the single blocking legacy policy drop to remain.'
}

foreach ($requiredNullableStatement in $nullableReplacements.Values) {
    if ($sql.IndexOf($requiredNullableStatement, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Nullable-column verification failed: $requiredNullableStatement"
    }
}
if ($sql.IndexOf($guardExpression, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
    throw 'Chick Grading restore-guard verification failed.'
}

$transactionPreamble = @"
-- STRUCTURAL MIGRATION FOR REVIEW AND TESTING ON FMS-DEV ONLY.
-- RLS definitions, RLS state, grants, revokes, and table records are excluded.
-- One legacy policy is dropped because it depends on an intentionally removed column.
-- The three new required relationship columns are temporarily nullable.
-- New CHECK and FOREIGN KEY constraints remain NOT VALID pending legacy-data cleanup.
-- The incompatible legacy i_warehouse.warehouse_type default is removed.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';

"@
$transactionPostamble = @"


notify pgrst, 'reload schema';
commit;
"@

$preparedSql = "$transactionPreamble$sql$transactionPostamble"
$outputDirectory = Split-Path -Parent $resolvedOutputFile
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
[IO.File]::WriteAllText($resolvedOutputFile, $preparedSql, $utf8NoBom)

$dropTableCount = [regex]::Matches($preparedSql, '(?im)^\s*drop\s+table\b').Count
$dropColumnCount = [regex]::Matches($preparedSql, '(?im)^\s*alter\s+table\b[^;]*drop\s+column\b').Count
$typeChangeCount = [regex]::Matches($preparedSql, '(?im)^\s*alter\s+table\b[^;]*alter\s+column\b[^;]*set\s+data\s+type\b').Count

Write-Host 'Structural migration prepared. It has NOT been applied.' -ForegroundColor Green
Write-Host "Output: $resolvedOutputFile" -ForegroundColor Green
Write-Host "Intentional DROP TABLE statements retained:  $dropTableCount" -ForegroundColor Yellow
Write-Host "Intentional DROP COLUMN statements retained: $dropColumnCount" -ForegroundColor Yellow
Write-Host "Column type changes retained:                $typeChangeCount" -ForegroundColor Yellow
Write-Host "Primary keys renamed without dropping:      $($primaryKeyDropMatches.Count)" -ForegroundColor Yellow
Write-Host 'Blocking legacy policies dropped:           1' -ForegroundColor Yellow
Write-Host "Constraint validations deferred:            $($validateConstraintMatches.Count)" -ForegroundColor Yellow
Write-Host 'Incompatible warehouse default removed:      1' -ForegroundColor Yellow
Get-Item -LiteralPath $resolvedOutputFile | Select-Object Name, Length, LastWriteTime
