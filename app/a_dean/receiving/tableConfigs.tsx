import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Button } from '@/components/ui/button'
import { HandCoins, Map } from 'lucide-react'
import { toast } from 'sonner'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

export const getPendingReceivingColumns = (
  route: AppRouterInstance,
  setValue: any
): ColumnConfig[] => [
  { key: 'action', label: 'Action', type: 'button', disabled: false },
  { key: 'id', label: 'Approval ID', type: 'text', disabled: true },
  { key: 'dr_num', label: 'Dr #', type: 'text', disabled: true },
  { key: 'status', label: 'Status', type: 'text', disabled: true },
  { key: 'decided_by_email', label: 'Decided By', type: 'text', disabled: true },
  { key: 'decided_at', label: 'Decision Date', type: 'text', disabled: true },
  { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
  { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
]

export const renderPendingReceivingCell = (
  col: ColumnConfig,
  row: RowDataKey,
  route: AppRouterInstance,
  setValue: any
) => {
  if (col.key === 'action') {
    return (
      <div className="flex justify-end gap-2">
        <Button
          className="bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs"
          onClick={() => {
            if (row.status === 'Approved') {
              toast.warning(
                'Only pending documents are allowed to be edited on this module'
              )
              return
            }

            setValue('forApproval', { row })
            route.push('/a_dean/receiving/approval')
          }}
        >
          <HandCoins />
          Receive
        </Button>
      </div>
    )
  }

  const value = row[col.key]
  return value ? String(value) : '-'
}

export const receivedColumns: ColumnConfig[] = [
  { key: 'action', label: 'Trace', type: 'button', disabled: true },
  { key: 'id', label: 'ID', type: 'text', disabled: true },
  { key: 'brdr_ref_no', label: 'Breeder Ref No.', type: 'text', disabled: true },
  { key: 'sku', label: 'Item', type: 'text', disabled: true },
  { key: 'actual_count', label: 'Total', type: 'text', disabled: true },
  { key: 'dr_num', label: 'DR #', type: 'text', disabled: true },
  { key: 'plate_no', label: 'Plate No.', type: 'text', disabled: true },
  { key: 'driver', label: 'Driver', type: 'text', disabled: true },
]

export const renderReceivedCell = (
  col: ColumnConfig,
  row: RowDataKey,
  route: AppRouterInstance,
  setValue: any
) => {
  if (col.key === 'action') {
    return (
      <div className="flex justify-end gap-2">
        <Button
          className="border hover:bg-foreground/10 bg-white border-green-400 text-green-400 p-1 rounded-xs"
          onClick={() => {
            setValue('traceBreederRef', row.brdr_ref_no)
            route.push('/a_dean/trace/')
          }}
        >
          <Map />
          Trace
        </Button>
      </div>
    )
  }

  const value = row[col.key]
  return value ? String(value) : '-'
}