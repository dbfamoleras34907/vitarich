const normalize = (value: string) => value.trim().toUpperCase()

export type BatchReallocationLine = {
  id: string
  groupKey: string
  itemCode: string
  batchKey: string
  allocatedBaseQty: number
  requestedBaseQty: number
}

export type BatchReallocationCandidate = {
  key: string
  itemCode: string
  warehouseCode: string
  batchNumber: string
  onHandBaseQty: number
  oldestDate: string
}

export type BatchReallocationAllocation = {
  groupKey: string
  sourceLineId: string
  candidateKey: string
  baseQty: number
  status: 'preserved' | 'reallocated' | 'shortage'
}

export type BatchReallocationPlan = {
  allocations: BatchReallocationAllocation[]
  reallocatedBaseQty: number
  shortageBaseQty: number
}

const positiveQuantity = (value: number) => Number.isFinite(value) && value > 0 ? value : 0

export function planBatchQuantityReallocation(
  lines: BatchReallocationLine[],
  candidates: BatchReallocationCandidate[],
  tolerance = 0.000001,
): BatchReallocationPlan {
  const candidateByKey = new Map<string, BatchReallocationCandidate>()
  candidates.forEach(candidate => {
    const existing = candidateByKey.get(candidate.key)
    if (!existing || positiveQuantity(candidate.onHandBaseQty) > positiveQuantity(existing.onHandBaseQty)) {
      candidateByKey.set(candidate.key, candidate)
    }
  })

  const remainingByCandidate = new Map(
    Array.from(candidateByKey, ([key, candidate]) => [key, positiveQuantity(candidate.onHandBaseQty)]),
  )
  const groups = new Map<string, {
    itemCode: string
    requestedBaseQty: number
    remainingBaseQty: number
    firstLineId: string
    shortageSourceLineId: string
    shortageCandidateKey: string
  }>()

  lines.forEach(line => {
    if (groups.has(line.groupKey)) return
    const requestedBaseQty = positiveQuantity(line.requestedBaseQty)
    groups.set(line.groupKey, {
      itemCode: line.itemCode,
      requestedBaseQty,
      remainingBaseQty: requestedBaseQty,
      firstLineId: line.id,
      shortageSourceLineId: line.id,
      shortageCandidateKey: line.batchKey,
    })
  })

  const allocations: BatchReallocationAllocation[] = []
  lines.forEach(line => {
    const group = groups.get(line.groupKey)
    if (!group || group.remainingBaseQty <= tolerance || !line.batchKey) return

    const candidateRemaining = remainingByCandidate.get(line.batchKey) ?? 0
    const allocatedBaseQty = positiveQuantity(line.allocatedBaseQty)
    const preservedBaseQty = Math.min(allocatedBaseQty, candidateRemaining, group.remainingBaseQty)
    if (preservedBaseQty > tolerance) {
      allocations.push({
        groupKey: line.groupKey,
        sourceLineId: line.id,
        candidateKey: line.batchKey,
        baseQty: preservedBaseQty,
        status: 'preserved',
      })
      remainingByCandidate.set(line.batchKey, Math.max(candidateRemaining - preservedBaseQty, 0))
      group.remainingBaseQty = Math.max(group.remainingBaseQty - preservedBaseQty, 0)
    }

    if (allocatedBaseQty - preservedBaseQty > tolerance) {
      group.shortageSourceLineId = line.id
      group.shortageCandidateKey = line.batchKey
    }
  })

  const orderedCandidates = Array.from(candidateByKey.values()).sort((left, right) => {
    const leftDate = left.oldestDate || '9999-12-31'
    const rightDate = right.oldestDate || '9999-12-31'
    return leftDate.localeCompare(rightDate) ||
      left.batchNumber.localeCompare(right.batchNumber, undefined, { numeric: true, sensitivity: 'base' }) ||
      left.warehouseCode.localeCompare(right.warehouseCode, undefined, { numeric: true, sensitivity: 'base' })
  })

  let reallocatedBaseQty = 0
  groups.forEach((group, groupKey) => {
    if (group.remainingBaseQty <= tolerance) return

    orderedCandidates.forEach(candidate => {
      if (group.remainingBaseQty <= tolerance || normalize(candidate.itemCode) !== normalize(group.itemCode)) return
      const availableBaseQty = remainingByCandidate.get(candidate.key) ?? 0
      const allocatedBaseQty = Math.min(group.remainingBaseQty, availableBaseQty)
      if (allocatedBaseQty <= tolerance) return

      allocations.push({
        groupKey,
        sourceLineId: group.shortageSourceLineId || group.firstLineId,
        candidateKey: candidate.key,
        baseQty: allocatedBaseQty,
        status: 'reallocated',
      })
      remainingByCandidate.set(candidate.key, Math.max(availableBaseQty - allocatedBaseQty, 0))
      group.remainingBaseQty = Math.max(group.remainingBaseQty - allocatedBaseQty, 0)
      reallocatedBaseQty += allocatedBaseQty
    })
  })

  let shortageBaseQty = 0
  groups.forEach((group, groupKey) => {
    if (group.remainingBaseQty <= tolerance) return
    allocations.push({
      groupKey,
      sourceLineId: group.shortageSourceLineId || group.firstLineId,
      candidateKey: group.shortageCandidateKey,
      baseQty: group.remainingBaseQty,
      status: 'shortage',
    })
    shortageBaseQty += group.remainingBaseQty
  })

  return { allocations, reallocatedBaseQty, shortageBaseQty }
}
