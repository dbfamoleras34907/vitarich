'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listBroilerCycleReferenceOptions,
  type BroilerCycleReferenceOption,
} from '@/lib/data/repositories/broilerCycleReferences'

const ALL_CYCLES = '__all_cycles__'

type BroilerCycleHistoryFilterProps = {
  farmIdentifier?: number | string | null
  value: string
  onValueChange: (value: string) => void
  id: string
}

export default function BroilerCycleHistoryFilter({
  farmIdentifier,
  value,
  onValueChange,
  id,
}: BroilerCycleHistoryFilterProps) {
  const [options, setOptions] = useState<BroilerCycleReferenceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  const farmKey = String(farmIdentifier ?? '').trim()

  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      setOptions([])
      if (valueRef.current) onValueChangeRef.current('')

      listBroilerCycleReferenceOptions({ farmIdentifier: farmKey || null })
        .then(rows => {
          if (cancelled) return
          setOptions(rows)
          if (valueRef.current && !rows.some(row => row.value === valueRef.current)) {
            onValueChangeRef.current('')
          }
        })
        .catch((loadError: unknown) => {
          if (cancelled) return
          setOptions([])
          setError(loadError instanceof Error ? loadError.message : 'Unable to load cycles.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [farmKey])

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Cycle #</Label>
      <div className="relative">
        <Select
          value={value || ALL_CYCLES}
          onValueChange={nextValue => onValueChange(nextValue === ALL_CYCLES ? '' : nextValue)}
          disabled={loading}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={loading ? 'Loading cycles...' : 'All cycles'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CYCLES}>All cycles</SelectItem>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && <Loader2 className="pointer-events-none absolute right-8 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
