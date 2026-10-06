"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "backup" | "restore";

type WritableFile = {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
};

type BrowserFileHandle = {
  createWritable(): Promise<WritableFile>;
};

type BrowserDirectoryHandle = {
  name: string;

  getFileHandle(
    name: string,
    options?: {
      create?: boolean;
    }
  ): Promise<BrowserFileHandle>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
      id?: string;
    }) => Promise<BrowserDirectoryHandle>;
  }
}

function escapeBatValue(value: string) {
  return value.replace(/%/g, "%%");
}

function parseSchemas(value: string) {
  return value
    .split(",")
    .map((schema) => schema.trim())
    .filter(Boolean);
}

function isValidSchemaName(schema: string) {
  return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(schema);
}

export default function SupabaseBackupRestorePage() {
  const [mode, setMode] = useState<Mode>("backup");

  const [dbUrl, setDbUrl] = useState("");

  const [backupName, setBackupName] = useState("");
  const [backupRoot, setBackupRoot] = useState(".\\backups");
  const [schemas, setSchemas] = useState("public");

  const [restoreDirectory, setRestoreDirectory] =
    useState<BrowserDirectoryHandle | null>(null);

  const [restoreFolderName, setRestoreFolderName] = useState("");
  const [restoreFolderValid, setRestoreFolderValid] = useState(false);
  const [restoreFolderError, setRestoreFolderError] = useState("");

  const [restoreConfirmation, setRestoreConfirmation] = useState("");

  const [showDbUrl, setShowDbUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const defaultBackupName = useMemo(() => {
    const now = new Date();

    const pad = (value: number) =>
      String(value).padStart(2, "0");

    return `${now.getFullYear()}-${pad(
      now.getMonth() + 1
    )}-${pad(now.getDate())}_${pad(
      now.getHours()
    )}-${pad(now.getMinutes())}-${pad(
      now.getSeconds()
    )}`;
  }, []);

  const finalBackupName =
    backupName.trim() || defaultBackupName;

  const cleanBackupRoot =
    backupRoot.trim().replace(/[\\]+$/, "") ||
    ".\\backups";

  const backupPath =
    `${cleanBackupRoot}\\${finalBackupName}`;

  const schemaList = useMemo(
    () => parseSchemas(schemas),
    [schemas]
  );

  const invalidSchemas = useMemo(
    () =>
      schemaList.filter(
        (schema) => !isValidSchemaName(schema)
      ),
    [schemaList]
  );

  const schemaArguments = useMemo(() => {
    return schemaList
      .filter(isValidSchemaName)
      .map((schema) => `--schema="${schema}"`)
      .join(" ");
  }, [schemaList]);

  // =========================================================
  // BACKUP BAT
  // =========================================================

  const backupCommand = useMemo(() => {
    if (!dbUrl.trim()) return "";
    if (!schemaList.length) return "";
    if (invalidSchemas.length) return "";

    const safeDbUrl =
      escapeBatValue(dbUrl.trim());

    const safeBackupPath =
      escapeBatValue(backupPath);

    return `@echo off
setlocal

title Supabase PostgreSQL Backup

echo.
echo =============================================
echo        SUPABASE DATABASE BACKUP
echo =============================================
echo.

set "DB_URL=${safeDbUrl}"
set "BACKUP_DIR=${safeBackupPath}"

REM =============================================
REM CHECK PG_DUMP
REM =============================================

where pg_dump >nul 2>&1

if errorlevel 1 (
  echo.
  echo =============================================
  echo ERROR: pg_dump NOT FOUND
  echo =============================================
  echo.
  echo PostgreSQL client tools are required.
  echo.
  echo Test using:
  echo.
  echo pg_dump --version
  echo.
  pause
  exit /b 1
)

echo PostgreSQL client:
pg_dump --version

echo.

REM =============================================
REM CREATE BACKUP DIRECTORY
REM =============================================

if not exist "%BACKUP_DIR%" (
  mkdir "%BACKUP_DIR%"
)

if errorlevel 1 goto ERROR

echo Backup folder:
echo %BACKUP_DIR%

echo.
echo Schemas:
echo ${schemaList.join(", ")}

echo.
echo =============================================
echo [1/2] Backing up schema...
echo =============================================
echo.

pg_dump ^
  --dbname "%DB_URL%" ^
  --schema-only ^
  --no-owner ^
  --no-privileges ^
  --no-subscriptions ^
  ${schemaArguments} ^
  --file "%BACKUP_DIR%\\schema.sql"

if errorlevel 1 goto ERROR

echo.
echo =============================================
echo [2/2] Backing up data...
echo =============================================
echo.

pg_dump ^
  --dbname "%DB_URL%" ^
  --data-only ^
  --no-owner ^
  --no-privileges ^
  --no-subscriptions ^
  ${schemaArguments} ^
  --file "%BACKUP_DIR%\\data.sql"

if errorlevel 1 goto ERROR

echo.
echo =============================================
echo BACKUP COMPLETED SUCCESSFULLY
echo =============================================
echo.

echo Backup folder:
echo %BACKUP_DIR%

echo.
echo Files created:
echo.
echo schema.sql
echo data.sql
echo.

pause
exit /b 0


:ERROR

echo.
echo =============================================
echo BACKUP FAILED
echo =============================================
echo.
echo Check the PostgreSQL error above.
echo.

pause
exit /b 1`;
  }, [
    dbUrl,
    backupPath,
    schemaList,
    schemaArguments,
    invalidSchemas,
  ]);

  // =========================================================
  // RESTORE BAT
  // =========================================================

  const restoreCommand = useMemo(() => {
    if (!dbUrl.trim()) return "";
    if (!restoreDirectory) return "";
    if (!restoreFolderValid) return "";
    if (restoreConfirmation !== "RESTORE") return "";

    const safeDbUrl =
      escapeBatValue(dbUrl.trim());

    return `@echo off
setlocal

title Supabase PostgreSQL Restore

echo.
echo =============================================
echo        SUPABASE DATABASE RESTORE
echo =============================================
echo.

REM =============================================
REM DATABASE
REM =============================================

set "DB_URL=${safeDbUrl}"

REM =============================================
REM BACKUP DIRECTORY
REM =============================================

REM Use the folder where this BAT file is located.

set "BACKUP_DIR=%~dp0"

REM Temporary cleaned schema file.

set "TEMP_SCHEMA=%TEMP%\\supabase_schema_%RANDOM%_%RANDOM%.sql"

echo Backup folder:
echo %BACKUP_DIR%

echo.

REM =============================================
REM CHECK PSQL
REM =============================================

where psql >nul 2>&1

if errorlevel 1 (
  echo.
  echo =============================================
  echo ERROR: psql NOT FOUND
  echo =============================================
  echo.
  echo PostgreSQL client tools are required.
  echo.
  echo Test using:
  echo.
  echo psql --version
  echo.
  pause
  exit /b 1
)

echo PostgreSQL client:
psql --version

echo.

REM =============================================
REM CHECK BACKUP FILES
REM =============================================

if not exist "%BACKUP_DIR%schema.sql" (
  echo.
  echo =============================================
  echo ERROR
  echo =============================================
  echo.
  echo schema.sql was not found.
  echo.
  echo Expected:
  echo %BACKUP_DIR%schema.sql
  echo.
  pause
  exit /b 1
)

if not exist "%BACKUP_DIR%data.sql" (
  echo.
  echo =============================================
  echo ERROR
  echo =============================================
  echo.
  echo data.sql was not found.
  echo.
  echo Expected:
  echo %BACKUP_DIR%data.sql
  echo.
  pause
  exit /b 1
)

echo Backup files found.
echo.

REM =============================================
REM PREPARE SCHEMA
REM =============================================

echo =============================================
echo PREPARING SCHEMA
echo =============================================
echo.

echo Removing CREATE SCHEMA public from
echo a temporary copy of schema.sql.
echo.

REM
REM Supabase already has the public schema.
REM
REM This removes ONLY:
REM
REM CREATE SCHEMA public;
REM
REM The original schema.sql is not modified.
REM

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$inputFile = Join-Path $env:BACKUP_DIR 'schema.sql';" ^
  "$outputFile = $env:TEMP_SCHEMA;" ^
  "$content = Get-Content -LiteralPath $inputFile;" ^
  "$content = $content | Where-Object { $_ -notmatch '^\\s*CREATE\\s+SCHEMA\\s+(IF\\s+NOT\\s+EXISTS\\s+)?\\"?public\\"?\\s*;\\s*$' };" ^
  "[System.IO.File]::WriteAllLines($outputFile, [string[]]$content, (New-Object System.Text.UTF8Encoding($false)))"

if errorlevel 1 (
  echo.
  echo =============================================
  echo ERROR
  echo =============================================
  echo.
  echo Failed to prepare schema.sql.
  echo.
  goto CLEANUP_ERROR
)

if not exist "%TEMP_SCHEMA%" (
  echo.
  echo =============================================
  echo ERROR
  echo =============================================
  echo.
  echo Temporary schema file was not created.
  echo.
  goto CLEANUP_ERROR
)

echo Schema prepared successfully.
echo.
echo Existing Supabase public schema will be reused.

echo.
echo =============================================
echo RESTORE STARTING
echo =============================================
echo.

psql ^
  --single-transaction ^
  --variable ON_ERROR_STOP=1 ^
  --file "%TEMP_SCHEMA%" ^
  --command "SET session_replication_role = replica" ^
  --file "%BACKUP_DIR%data.sql" ^
  --dbname "%DB_URL%"

if errorlevel 1 goto CLEANUP_ERROR

REM =============================================
REM CLEANUP
REM =============================================

if exist "%TEMP_SCHEMA%" (
  del /q "%TEMP_SCHEMA%" >nul 2>&1
)

echo.
echo =============================================
echo RESTORE COMPLETED SUCCESSFULLY
echo =============================================
echo.

echo Schema restored.
echo Data restored.
echo.

pause
exit /b 0


:CLEANUP_ERROR

if exist "%TEMP_SCHEMA%" (
  del /q "%TEMP_SCHEMA%" >nul 2>&1
)

echo.
echo =============================================
echo RESTORE FAILED
echo =============================================
echo.
echo The transaction was stopped because
echo PostgreSQL encountered an error.
echo.
echo The temporary schema file was removed.
echo.
echo Check the error above.
echo.

pause
exit /b 1`;
  }, [
    dbUrl,
    restoreDirectory,
    restoreFolderValid,
    restoreConfirmation,
  ]);

  const command =
    mode === "backup"
      ? backupCommand
      : restoreCommand;

  const canGenerate =
    mode === "backup"
      ? Boolean(
          dbUrl.trim() &&
            schemaList.length &&
            invalidSchemas.length === 0
        )
      : Boolean(
          dbUrl.trim() &&
            restoreDirectory &&
            restoreFolderValid &&
            restoreConfirmation === "RESTORE"
        );

  // =========================================================
  // BROWSE RESTORE FOLDER
  // =========================================================

  async function browseRestoreFolder() {
    setRestoreFolderError("");
    setRestoreFolderValid(false);
    setRestoreDirectory(null);
    setRestoreFolderName("");
    setSaved(false);

    if (!window.showDirectoryPicker) {
      setRestoreFolderError(
        "Folder browsing is not supported by this browser. Use Chrome or Microsoft Edge."
      );

      return;
    }

    try {
      const directory =
        await window.showDirectoryPicker({
          mode: "readwrite",
          id: "supabase-restore-folder",
        });

      try {
        await directory.getFileHandle(
          "schema.sql"
        );
      } catch {
        setRestoreFolderName(
          directory.name
        );

        setRestoreFolderError(
          "schema.sql was not found in this folder."
        );

        return;
      }

      try {
        await directory.getFileHandle(
          "data.sql"
        );
      } catch {
        setRestoreFolderName(
          directory.name
        );

        setRestoreFolderError(
          "data.sql was not found in this folder."
        );

        return;
      }

      setRestoreDirectory(directory);
      setRestoreFolderName(directory.name);
      setRestoreFolderValid(true);
      setRestoreFolderError("");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(error);

      setRestoreFolderError(
        "Unable to access the selected folder."
      );
    }
  }

  // =========================================================
  // COPY
  // =========================================================

  async function copyCommand() {
    if (!command) return;

    await navigator.clipboard.writeText(
      command
    );

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  // =========================================================
  // SAVE BAT
  // =========================================================

  async function saveBat() {
    if (!command) return;

    if (
      mode === "restore" &&
      restoreDirectory
    ) {
      try {
        const fileHandle =
          await restoreDirectory.getFileHandle(
            "restore.bat",
            {
              create: true,
            }
          );

        const writable =
          await fileHandle.createWritable();

        await writable.write(command);
        await writable.close();

        setSaved(true);

        setTimeout(() => {
          setSaved(false);
        }, 2000);

        return;
      } catch (error) {
        console.error(error);

        setRestoreFolderError(
          "Unable to save restore.bat into the selected folder."
        );

        return;
      }
    }

    const blob = new Blob([command], {
      type: "text/plain;charset=utf-8",
    });

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `supabase-backup-${finalBackupName}.bat`;

    document.body.appendChild(anchor);

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  // =========================================================
  // RESET
  // =========================================================

  function resetForm() {
    setDbUrl("");

    setBackupName("");
    setBackupRoot(".\\backups");
    setSchemas("public");

    setRestoreDirectory(null);
    setRestoreFolderName("");
    setRestoreFolderValid(false);
    setRestoreFolderError("");
    setRestoreConfirmation("");

    setCopied(false);
    setSaved(false);
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);

    setCopied(false);
    setSaved(false);
    setRestoreConfirmation("");
  }

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-5">
      <div className="mx-auto w-full max-w-4xl space-y-4">

        {/* Header */}

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h1 className="text-xl font-semibold">
            Supabase Backup / Restore
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Docker-free PostgreSQL backup and restore utility.
          </p>

          <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 p-3">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Docker is not required
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Uses native pg_dump and psql PostgreSQL tools.
            </p>
          </div>
        </div>

        {/* Mode */}

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Question number={1}>
            What do you want to do?
          </Question>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
            <Button
              type="button"
              variant={
                mode === "backup"
                  ? "default"
                  : "outline"
              }
              onClick={() =>
                switchMode("backup")
              }
            >
              Backup
            </Button>

            <Button
              type="button"
              variant={
                mode === "restore"
                  ? "destructive"
                  : "outline"
              }
              onClick={() =>
                switchMode("restore")
              }
            >
              Restore
            </Button>
          </div>
        </div>

        {/* Main */}

        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">

          <div className="space-y-5 p-4">

            {/* DB URL */}

            <div>
              <Question number={2}>
                What is your Supabase database connection string?
              </Question>

              <div className="mt-2 flex gap-2">
                <Input
                  type={
                    showDbUrl
                      ? "text"
                      : "password"
                  }
                  value={dbUrl}
                  onChange={(e) =>
                    setDbUrl(
                      e.target.value
                    )
                  }
                  placeholder="postgresql://postgres.PROJECT_REF:PASSWORD@..."
                  className="min-w-0 flex-1 font-mono text-sm"
                  autoComplete="off"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setShowDbUrl(
                      (current) =>
                        !current
                    )
                  }
                >
                  {showDbUrl
                    ? "Hide"
                    : "Show"}
                </Button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Supabase Dashboard → Connect → Session Pooler
              </p>
            </div>

            {/* BACKUP */}

            {mode === "backup" && (
              <>
                <div>
                  <Question number={3}>
                    Which schemas do you want to backup?
                  </Question>

                  <Input
                    value={schemas}
                    onChange={(e) =>
                      setSchemas(
                        e.target.value
                      )
                    }
                    placeholder="public"
                    className="mt-2 font-mono text-sm"
                  />

                  <p className="mt-2 text-xs text-muted-foreground">
                    Separate multiple schemas with commas.
                  </p>

                  {invalidSchemas.length >
                    0 && (
                    <p className="mt-2 text-xs text-destructive">
                      Invalid schema:{" "}
                      {invalidSchemas.join(
                        ", "
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <Question number={4}>
                    Where do you want to save the backup?
                  </Question>

                  <Input
                    value={backupRoot}
                    onChange={(e) =>
                      setBackupRoot(
                        e.target.value
                      )
                    }
                    placeholder=".\\backups"
                    className="mt-2 font-mono text-sm"
                  />
                </div>

                <div>
                  <Question number={5}>
                    What should the backup be called?
                  </Question>

                  <Input
                    value={backupName}
                    onChange={(e) =>
                      setBackupName(
                        e.target.value
                      )
                    }
                    placeholder={
                      defaultBackupName
                    }
                    className="mt-2"
                  />

                  <p className="mt-2 text-xs text-muted-foreground">
                    Leave empty to use{" "}
                    <span className="font-mono">
                      {defaultBackupName}
                    </span>
                  </p>
                </div>

                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Backup output
                  </p>

                  <div className="mt-2 space-y-1 break-all font-mono text-xs">
                    <p>
                      {backupPath}
                      \schema.sql
                    </p>

                    <p>
                      {backupPath}
                      \data.sql
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* RESTORE */}

            {mode === "restore" && (
              <>
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="font-medium text-destructive">
                    Restore warning
                  </p>

                  <p className="mt-1 text-sm">
                    Restore may conflict if the target already contains
                    your application tables or database objects.
                  </p>
                </div>

                {/* Folder */}

                <div>
                  <Question number={3}>
                    Select the backup folder.
                  </Question>

                  <div className="mt-2 flex gap-2">
                    <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border bg-background px-3">
                      <span
                        className={
                          restoreFolderName
                            ? "truncate font-mono text-sm"
                            : "truncate text-sm text-muted-foreground"
                        }
                      >
                        {restoreFolderName ||
                          "No folder selected"}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={
                        browseRestoreFolder
                      }
                    >
                      Browse Folder
                    </Button>
                  </div>

                  {restoreFolderValid && (
                    <div className="mt-2 rounded-md border border-green-500/30 bg-green-500/10 p-2">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">
                        ✓ Valid backup folder
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        schema.sql and data.sql were found.
                      </p>
                    </div>
                  )}

                  {restoreFolderError && (
                    <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2">
                      <p className="text-xs text-destructive">
                        {restoreFolderError}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirmation */}

                <div>
                  <Question number={4}>
                    Type RESTORE to confirm.
                  </Question>

                  <Input
                    value={
                      restoreConfirmation
                    }
                    onChange={(e) =>
                      setRestoreConfirmation(
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="RESTORE"
                    className="mt-2 font-mono"
                  />

                  {restoreConfirmation &&
                    restoreConfirmation !==
                      "RESTORE" && (
                      <p className="mt-2 text-xs text-destructive">
                        You must type RESTORE exactly.
                      </p>
                    )}
                </div>

                {restoreFolderValid && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Restore folder
                    </p>

                    <div className="mt-2 space-y-1 font-mono text-xs">
                      <p>
                        {restoreFolderName}
                        \schema.sql
                      </p>

                      <p>
                        {restoreFolderName}
                        \data.sql
                      </p>

                      <p className="pt-2 font-medium">
                        {restoreFolderName}
                        \restore.bat
                      </p>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      During restore, CREATE SCHEMA public is removed
                      from a temporary copy so the existing Supabase
                      public schema can be reused.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Generated BAT */}

          <div className="border-t">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  Generated Windows BAT
                </p>

                <p className="text-xs text-muted-foreground">
                  {mode === "restore"
                    ? "restore.bat will be saved directly inside the selected backup folder."
                    : "Generate your backup BAT file."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canGenerate}
                  onClick={copyCommand}
                >
                  {copied
                    ? "Copied!"
                    : "Copy"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={!canGenerate}
                  onClick={saveBat}
                >
                  {saved
                    ? "Saved!"
                    : mode ===
                        "restore"
                      ? "Save restore.bat"
                      : "Download .bat"}
                </Button>
              </div>
            </div>

            <pre
              className={`max-h-[500px] overflow-auto whitespace-pre-wrap break-all border-t bg-muted/40 p-4 font-mono text-xs leading-6 ${
                command
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {command ||
                (mode === "backup"
                  ? "Enter your database connection string to generate the backup BAT file."
                  : "Select the backup folder, enter the database connection string, and type RESTORE.")}
            </pre>
          </div>

          {/* Footer */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
            <div className="text-xs text-muted-foreground">
              {mode === "backup"
                ? "Requires PostgreSQL pg_dump."
                : "Requires PostgreSQL psql + Windows PowerShell."}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Question({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-6 min-w-6 items-center justify-center rounded bg-destructive text-xs font-semibold text-destructive-foreground">
        {number}
      </span>

      <div className="pt-0.5 text-sm font-semibold text-destructive">
        {children}
      </div>
    </div>
  );
}