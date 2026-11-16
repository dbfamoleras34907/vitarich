import type { HatcheryLifecycle, HatcheryLifecycleNode, HatcheryLifecycleStage } from '@/lib/data/repositories/hatcheryLifecycleReport'

export const HATCHERY_TRACE_STAGES = [
  'Storage',
  'Pre-Warming',
  'Setter',
  'Transfer',
  'Hatcher',
  'Pullout',
  'Chick Grading',
  'Dispatch',
] as const satisfies readonly HatcheryLifecycleStage[]

export type HatcheryTraceStage = typeof HATCHERY_TRACE_STAGES[number]
export type HatcheryTraceStatus = 'complete' | 'disposed' | 'in_progress'

export type HatcheryClassificationTrace = {
  key: string
  eggClassificationRef: string
  classificationAt: string | null
  quantity: number | null
  uom: string | null
  status: HatcheryTraceStatus
  elapsedDays: number | null
  currentStage: HatcheryLifecycleStage
  stages: Partial<Record<HatcheryTraceStage, HatcheryLifecycleNode[]>>
}

export type HatcheryDrTrace = {
  key: string
  receivingId: number
  taId: number | null
  drRefNo: string
  receivingDate: string | null
  farmId: number
  children: HatcheryClassificationTrace[]
}

function active(nodes: HatcheryLifecycleNode[]) {
  return nodes.filter(node => !node.voided)
}

function dateMilliseconds(value: string | null) {
  if (!value) return null
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) ? milliseconds : null
}

function latest(nodes: HatcheryLifecycleNode[]) {
  return [...nodes].sort((left, right) => {
    const leftTime = dateMilliseconds(left.occurredAt) ?? -Infinity
    const rightTime = dateMilliseconds(right.occurredAt) ?? -Infinity
    if (leftTime !== rightTime) return leftTime - rightTime
    return left.documentId - right.documentId
  }).at(-1) ?? null
}

function elapsedDays(startedAt: string | null, endedAt: string | null) {
  const start = dateMilliseconds(startedAt)
  const end = dateMilliseconds(endedAt)
  return start == null || end == null || end < start ? null : (end - start) / 86_400_000
}

function descendants(lifecycle: HatcheryLifecycle, rootNodeKey: string) {
  const childrenByParent = new Map<string, string[]>()
  for (const edge of lifecycle.edges) {
    const values = childrenByParent.get(edge.fatherNodeKey) ?? []
    values.push(edge.childNodeKey)
    childrenByParent.set(edge.fatherNodeKey, values)
  }

  const keys = new Set<string>([rootNodeKey])
  const queue = [rootNodeKey]
  while (queue.length) {
    const parent = queue.shift()!
    for (const child of childrenByParent.get(parent) ?? []) {
      if (!keys.has(child)) {
        keys.add(child)
        queue.push(child)
      }
    }
  }
  return lifecycle.nodes.filter(node => keys.has(node.nodeKey))
}

/** Builds DR parent rows and Egg Classification child paths from the report's linked nodes. */
export function hatcheryDrTraces(lifecycles: HatcheryLifecycle[]): HatcheryDrTrace[] {
  return lifecycles.map(lifecycle => {
    const receiving = lifecycle.nodes.find(node => node.stage === 'Receiving')
    const classifications = active(lifecycle.nodes.filter(node => node.stage === 'Classification'))

    return {
      key: String(lifecycle.receivingId),
      receivingId: lifecycle.receivingId,
      taId: lifecycle.taId,
      drRefNo: lifecycle.documentNo,
      receivingDate: receiving?.occurredAt ?? lifecycle.reportDate,
      farmId: lifecycle.farmId,
      children: classifications.map(classification => {
        const path = active(descendants(lifecycle, classification.nodeKey))
        const stages = Object.fromEntries(HATCHERY_TRACE_STAGES.map(stage => [stage, path.filter(node => node.stage === stage)])) as Partial<Record<HatcheryTraceStage, HatcheryLifecycleNode[]>>
        const dispatch = latest(stages.Dispatch ?? [])
        const disposal = latest(path.filter(node => node.stage === 'Disposal'))
        const terminal = dispatch ?? disposal ?? latest(path)
        const current = terminal ?? classification
        const status: HatcheryTraceStatus = dispatch ? 'complete' : disposal ? 'disposed' : 'in_progress'

        return {
          key: classification.nodeKey,
          eggClassificationRef: classification.documentNo || classification.reference || `Classification ${classification.documentId}`,
          classificationAt: classification.occurredAt,
          quantity: classification.quantity,
          uom: classification.uom,
          status,
          elapsedDays: elapsedDays(receiving?.occurredAt ?? lifecycle.reportDate, terminal?.occurredAt ?? null),
          currentStage: current.stage,
          stages,
        }
      }),
    }
  })
}

export function hatcheryDrCompletion(trace: HatcheryDrTrace) {
  const total = trace.children.length
  const completed = trace.children.filter(child => child.status === 'complete' || child.status === 'disposed').length
  return { total, completed, isComplete: total > 0 && total === completed }
}

export const hatcheryTraceStageLabel: Record<HatcheryTraceStage, string> = {
  Storage: 'Egg Storage',
  'Pre-Warming': 'Pre-Warming',
  Setter: 'Setter',
  Transfer: 'Transfer',
  Hatcher: 'Hatcher',
  Pullout: 'Pullout',
  'Chick Grading': 'DOC Classification',
  Dispatch: 'DOC Dispatch',
}
