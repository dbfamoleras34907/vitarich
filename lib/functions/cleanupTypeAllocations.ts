type CleanupAllocationScope = {
  fromWarehouseId?: number | null
  fromWarehouseCode?: string | null
  itemId?: number | null
  itemCode?: string | null
}

type CleanupQuantityLine = {
  requestedAltQty?: number
  altQty: number
}

export function cleanupAllocationScopeKey(scope: CleanupAllocationScope) {
  const warehouse = scope.fromWarehouseId != null
    ? `ID:${scope.fromWarehouseId}`
    : `CODE:${String(scope.fromWarehouseCode ?? '').trim().toUpperCase()}`
  const item = scope.itemId != null
    ? `ID:${scope.itemId}`
    : `CODE:${String(scope.itemCode ?? '').trim().toUpperCase()}`
  return `${warehouse}|${item}`
}

export function cleanupAllocationMatchesLine(
  allocation: CleanupAllocationScope,
  line: CleanupAllocationScope,
) {
  return cleanupAllocationScopeKey(allocation) === cleanupAllocationScopeKey(line)
}

export function cleanupLineGroupQuantity(lines: CleanupQuantityLine[]) {
  return lines[0]?.requestedAltQty
    ?? lines.reduce((total, line) => total + Number(line.altQty || 0), 0)
}
