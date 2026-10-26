type PostgresErrorLike = {
  code?: unknown
  details?: unknown
  hint?: unknown
  message?: unknown
}

const nonEmptyText = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

export function getPostgresErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message.trim() || fallback
  if (!error || typeof error !== 'object') return fallback

  const postgresError = error as PostgresErrorLike
  const message = nonEmptyText(postgresError.message)
  const details = nonEmptyText(postgresError.details)
  const hint = nonEmptyText(postgresError.hint)
  const code = nonEmptyText(postgresError.code)
  const parts = [message, details && details !== message ? `Details: ${details}` : null, hint ? `Hint: ${hint}` : null]
    .filter((value): value is string => Boolean(value))

  if (parts.length === 0) return fallback
  return `${parts.join(' ')}${code ? ` (Database code: ${code})` : ''}`
}

export function isUniqueConstraintViolation(error: unknown, constraintName?: string) {
  if (!error || typeof error !== 'object') return false

  const postgresError = error as PostgresErrorLike
  if (postgresError.code !== '23505') return false
  if (!constraintName) return true

  const errorText = `${String(postgresError.details ?? '')} ${String(postgresError.message ?? '')}`
    .toLowerCase()

  return errorText.includes(constraintName.toLowerCase())
}
