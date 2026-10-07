'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import SearchableCombobox from '@/components/SearchableCombobox'
import { Label } from '@/components/ui/label'
import {
  getSelectableBroilerFarmCycles,
  type SelectableBroilerFarmCycle,
} from '@/lib/data/repositories/broilerFarmCycles'

type BroilerCycleSelectProps = {
  farmId: number | null | undefined
  value: string
  onValueChange: (cycleId: string, cycle: SelectableBroilerFarmCycle | null) => void
  disabled?: boolean
  required?: boolean
  label?: string
  className?: string
  contentPositionerZIndex?: number
}

export default function BroilerCycleSelect({
  farmId,
  value,
  onValueChange,
  disabled = false,
  required = true,
  label = 'Cycle',
  className = 'w-full',
  contentPositionerZIndex,
}: BroilerCycleSelectProps) {
  const [loaded, setLoaded] = useState<{ farmId: number; cycles: SelectableBroilerFarmCycle[] }>({ farmId: 0, cycles: [] })
  const [loadError, setLoadError] = useState<{ farmId: number; message: string } | null>(null)
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])
  const numericFarmId = Number(farmId ?? 0)
  const validFarmId = Number.isInteger(numericFarmId) && numericFarmId > 0
  const cycles = useMemo(
    () => validFarmId && loaded.farmId === numericFarmId ? loaded.cycles : [],
    [loaded, numericFarmId, validFarmId],
  )
  const loading = validFarmId && loaded.farmId !== numericFarmId

  useEffect(() => {
    let cancelled = false
    if (!validFarmId) return
    getSelectableBroilerFarmCycles(numericFarmId)
      .then(rows => {
        if (cancelled) return
        setLoaded({ farmId: numericFarmId, cycles: rows })
        setLoadError(null)
        const selected = rows.find(row => String(row.id) === valueRef.current)
        if (selected) return
        const current = rows.find(row => row.status === 'Saved') ?? null
        onValueChangeRef.current(current ? String(current.id) : '', current)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError({ farmId: numericFarmId, message: error instanceof Error ? error.message : 'Unable to load Cycle Master. Refresh and try again.' })
          setLoaded({ farmId: numericFarmId, cycles: [] })
          onValueChangeRef.current('', null)
        }
      })

    return () => { cancelled = true }
  }, [numericFarmId, validFarmId])

  const items = useMemo(() => cycles.map(cycle => ({
    code: String(cycle.id),
    name: `${cycle.cycleMask || `Cycle ${cycle.cycleNumber}`} — ${cycle.displayStatus}`,
  })), [cycles])

  return (
    <div className="space-y-2">
      {label && <Label required={required}>{label}</Label>}
      <SearchableCombobox
        items={items}
        value={value}
        onValueChange={cycleId => onValueChange(
          cycleId,
          cycles.find(cycle => String(cycle.id) === cycleId) ?? null,
        )}
        showCode={false}
        allowSelectAll={false}
        disabled={disabled || loading || !farmId}
        placeholder={!farmId ? 'Select farm first' : loading ? 'Loading cycles...' : 'Select cycle...'}
        className={className}
        contentPositionerZIndex={contentPositionerZIndex}
      />
      {loadError?.farmId === numericFarmId && <p role="alert" className="text-xs text-destructive">{loadError.message}</p>}
    </div>
  )
}
