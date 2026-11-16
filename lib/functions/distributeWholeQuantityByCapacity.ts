export function distributeWholeQuantityByCapacity(
  requiredQty: number,
  capacities: number[],
  remainderOrder: number[] = capacities.map((_, index) => index),
): number[] {
  const allocations = capacities.map(() => 0)
  let remainingQty = Math.max(Math.floor(requiredQty), 0)
  const normalizedCapacities = capacities.map(capacity =>
    Number.isFinite(capacity) ? Math.max(Math.floor(capacity), 0) : 0
  )
  const orderedIndexes = Array.from(new Set([
    ...remainderOrder.filter(index => index >= 0 && index < capacities.length),
    ...capacities.map((_, index) => index),
  ]))

  while (remainingQty > 0) {
    const activeIndexes = orderedIndexes.filter(index => allocations[index] < normalizedCapacities[index])
    if (activeIndexes.length === 0) break

    const evenShare = Math.floor(remainingQty / activeIndexes.length)
    if (evenShare > 0) {
      activeIndexes.forEach(index => {
        const availableQty = normalizedCapacities[index] - allocations[index]
        const allocatedQty = Math.min(evenShare, availableQty, remainingQty)
        allocations[index] += allocatedQty
        remainingQty -= allocatedQty
      })
      continue
    }

    for (const index of activeIndexes) {
      if (remainingQty <= 0) break
      allocations[index] += 1
      remainingQty -= 1
    }
  }

  return allocations
}
