type PostgresErrorLike = {
  code?: unknown
  details?: unknown
  message?: unknown
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
