'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import SearchableDropdown from '@/lib/SearchableDropdown'
import type { CleanupTypeAllocation } from '../api'
import { listActiveBrCleanupTypes, type BrCleanupType } from '@/lib/data/repositories/brCleanupTypes'
import { createUuid } from '@/lib/utils/createUuid'

type DraftRow = {
  key: string
  id: number | string
  cleanupTypeId: number | null
  cleanupTypeCode: string
  cleanupTypeName: string
  quantity: string
  remarks: string
}

type AllocationScope = Pick<CleanupTypeAllocation,
  'fromWarehouseId' | 'fromWarehouseCode' | 'itemId' | 'itemCode'
>

type Props = {
  open: boolean
  editable: boolean
  lineLabel: string
  targetQuantity: number
  quantityUom: string
  scope: AllocationScope
  allocations: CleanupTypeAllocation[]
  onOpenChange: (open: boolean) => void
  onConfirm: (allocations: CleanupTypeAllocation[]) => void
}

const blankRow = (): DraftRow => ({
  key: createUuid(),
  id: createUuid(),
  cleanupTypeId: null,
  cleanupTypeCode: '',
  cleanupTypeName: '',
  quantity: '',
  remarks: '',
})

const isComplete = (row: DraftRow) => row.cleanupTypeId != null
  && row.quantity.trim() !== ''
  && Number.isFinite(Number(row.quantity))
  && Number(row.quantity) >= 0
  && Boolean(row.remarks.trim())

const isBlank = (row: DraftRow) => row.cleanupTypeId == null
  && !row.quantity.trim()
  && !row.remarks.trim()

export default function CleanupTypeAllocationSheet({
  open,
  editable,
  lineLabel,
  targetQuantity,
  quantityUom,
  scope,
  allocations,
  onOpenChange,
  onConfirm,
}: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => [
    ...allocations.map(allocation => ({
      key: String(allocation.id),
      id: allocation.id,
      cleanupTypeId: allocation.cleanupTypeId,
      cleanupTypeCode: allocation.cleanupTypeCode,
      cleanupTypeName: allocation.cleanupTypeName,
      quantity: String(allocation.quantity),
      remarks: allocation.remarks,
    })),
    ...(editable ? [blankRow()] : []),
  ])
  const [types, setTypes] = useState<BrCleanupType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    listActiveBrCleanupTypes()
      .then(result => { if (!cancelled) setTypes(result) })
      .catch(error => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Unable to load Cleanup Types.')
      })
      .finally(() => { if (!cancelled) setLoadingTypes(false) })
    return () => { cancelled = true }
  }, [open])

  const selectableTypes = useMemo(() => {
    const byId = new Map(types.map(type => [type.id, type]))
    allocations.forEach(allocation => {
      if (!byId.has(allocation.cleanupTypeId)) {
        byId.set(allocation.cleanupTypeId, {
          id: allocation.cleanupTypeId,
          code: allocation.cleanupTypeCode,
          name: allocation.cleanupTypeName,
          is_void: true,
          created_at: '',
          updated_at: null,
          voided_at: null,
        })
      }
    })
    return Array.from(byId.values())
  }, [allocations, types])

  const updateRow = (key: string, changes: Partial<DraftRow>) => {
    setRows(current => {
      const next = current.map(row => row.key === key ? { ...row, ...changes } : row)
      return editable && next.length > 0 && isComplete(next[next.length - 1])
        ? [...next, blankRow()]
        : next
    })
  }

  const addRow = () => {
    setRows(current => current.some(isBlank) ? current : [...current, blankRow()])
  }

  const deleteRow = (key: string) => {
    setRows(current => {
      const next = current.filter(row => row.key !== key)
      return next.length > 0 ? next : editable ? [blankRow()] : []
    })
  }

  const confirm = () => {
    const enteredRows = rows.filter(row => !isBlank(row))
    if (enteredRows.length === 0) {
      toast.error('Add at least one Cleanup Type allocation.')
      return
    }
    if (enteredRows.some(row => !isComplete(row))) {
      toast.error('Cleanup Type, Quantity, and Remarks are required for every entered row.')
      return
    }

    const typeIds = enteredRows.map(row => row.cleanupTypeId as number)
    if (new Set(typeIds).size !== typeIds.length) {
      toast.error('Each Cleanup Type can appear only once for this line.')
      return
    }

    const total = enteredRows.reduce((sum, row) => sum + Number(row.quantity), 0)
    if (Math.abs(total - targetQuantity) > 0.000001) {
      toast.error(`Cleanup Type Quantity must total ${targetQuantity.toLocaleString()} ${quantityUom}.`)
      return
    }

    onConfirm(enteredRows.map(row => ({
      id: row.id,
      cleanupTypeId: row.cleanupTypeId as number,
      cleanupTypeCode: row.cleanupTypeCode,
      cleanupTypeName: row.cleanupTypeName,
      quantity: Number(row.quantity),
      remarks: row.remarks.trim(),
      ...scope,
    })))
    onOpenChange(false)
  }

  const allocatedTotal = rows.filter(row => !isBlank(row))
    .reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b">
          <SheetTitle>Cleanup Type Allocation</SheetTitle>
          <SheetDescription>
            {lineLabel} · Required total: {targetQuantity.toLocaleString()} {quantityUom}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-[34%] border-r px-3 py-2">Cleanup Type</th>
                  <th className="w-[18%] border-r px-3 py-2 text-right">Quantity</th>
                  <th className="border-r px-3 py-2">Remarks</th>
                  <th className="w-12 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className="h-24 text-center text-muted-foreground">No Cleanup Type allocations.</td></tr>
                ) : rows.map(row => {
                  const selectedElsewhere = new Set(rows
                    .filter(candidate => candidate.key !== row.key && candidate.cleanupTypeId != null)
                    .map(candidate => candidate.cleanupTypeId))
                  const options = selectableTypes.filter(type => type.id === row.cleanupTypeId || !selectedElsewhere.has(type.id))
                  return (
                    <tr key={row.key} className="border-t align-top">
                      <td className="border-r p-1.5">
                        <SearchableDropdown
                          list={options}
                          codeLabel="code"
                          nameLabel="name"
                          value={row.cleanupTypeCode}
                          placeholder={loadingTypes ? 'Loading Cleanup Types...' : 'Search Cleanup Type...'}
                          width={360}
                          disabled={!editable || loadingTypes}
                          onChange={(_, type) => updateRow(row.key, {
                            cleanupTypeId: type.id,
                            cleanupTypeCode: type.code,
                            cleanupTypeName: type.name,
                          })}
                        />
                      </td>
                      <td className="border-r p-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={row.quantity}
                          readOnly={!editable}
                          onChange={event => updateRow(row.key, { quantity: event.target.value })}
                          className="text-right"
                        />
                      </td>
                      <td className="border-r p-1.5">
                        <Input
                          value={row.remarks}
                          readOnly={!editable}
                          placeholder="Required remarks"
                          maxLength={500}
                          onChange={event => updateRow(row.key, { remarks: event.target.value })}
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        {editable && (
                          <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRow(row.key)} aria-label="Delete allocation row">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {editable && (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addRow}>
              <Plus className="size-4" /> Add Row
            </Button>
          )}
        </div>

        <SheetFooter className="border-t bg-background sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Allocated: <span className="font-medium text-foreground">{allocatedTotal.toLocaleString()} {quantityUom}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{editable ? 'Cancel' : 'Close'}</Button>
            {editable && <Button type="button" onClick={confirm}>Confirm</Button>}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
