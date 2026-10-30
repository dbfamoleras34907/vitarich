export type BatchWarehouseMovement = {
  createdAt: string
  warehouseCode: string
}

export const toLocalDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isDateInput = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
}

export const getCanonicalBatchFarmId = (batchNumber: string) => {
  const match = batchNumber.trim().match(/^DOC:F(\d+):B\d+:/i)
  if (!match) return null

  const farmId = Number(match[1])
  return Number.isSafeInteger(farmId) && farmId > 0 ? farmId : null
}

export const buildBatchWarehouseReportHref = (
  batchNumber: string,
  movements: BatchWarehouseMovement[],
  currentDate = new Date(),
) => {
  const farmId = getCanonicalBatchFarmId(batchNumber)
  const origin = movements
    .map(movement => ({
      ...movement,
      timestamp: Date.parse(movement.createdAt),
    }))
    .filter(movement => movement.warehouseCode.trim() && Number.isFinite(movement.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)[0]

  if (!farmId || !origin) return ''

  const params = new URLSearchParams({
    source: 'batchTrail',
    farmId: String(farmId),
    warehouse: origin.warehouseCode.trim(),
    from: toLocalDateInput(new Date(origin.timestamp)),
    to: toLocalDateInput(currentDate),
  })

  return `/inv/whse-report?${params.toString()}`
}
