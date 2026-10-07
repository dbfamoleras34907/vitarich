'use client'

import { FARM_PROFILE_FIELDS } from '@/lib/farmProfileOptions'

import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Edit, FileSpreadsheet, FileUp, Loader2, RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import readXlsxFile from 'read-excel-file/browser'
import type { FarmDirectoryImportRow } from '@/lib/data/repositories/farmManagement.client'
import { APPROVED_FARM_STATUS } from '@/lib/data/repositories/farms'
import { getFarms } from './api'
import {
  exportFarmDirectoryWorkbook,
  parseFarmDirectoryImport,
} from './farmDirectoryWorkbook'
import { updateFarmDirectoryRows } from '@/lib/data/repositories/farmManagement.client'

const farmTypeLabels: Record<string, string> = {
  BE: 'Breeder Farm',
  HA: 'Hatcher',
  BR: 'Broiler',
}

const approvalStatusLabels: Record<string, string> = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export default function FarmMasterPage() {
  const { setValue } = useGlobalContext()
  const router = useRouter()
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importIssues, setImportIssues] = useState<string[]>([])
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [pendingImportRows, setPendingImportRows] = useState<FarmDirectoryImportRow[]>([])
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const getData = useCallback(async () => {
    setLoading(true)

    try {
      const data = await getFarms()
      setinitialRows((data ?? []) as RowDataKey[])
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load farms'))
      setinitialRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setImportIssues([])
    setImportMessage(null)

    try {
      const farms = await getFarms()
      setinitialRows(farms as RowDataKey[])
      const exportableFarms = farms.filter(farm =>
        String(farm.approval_status || APPROVED_FARM_STATUS) === APPROVED_FARM_STATUS,
      )
      await exportFarmDirectoryWorkbook(exportableFarms)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Unable to export farm information.')
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    setImportIssues([])
    setImportMessage(null)
    setPendingImportRows([])

    try {
      const sheets = await readXlsxFile(file)
      const farmsSheet = sheets.find(sheet => sheet.sheet.trim().toLowerCase() === 'farms')
      if (!farmsSheet) {
        setImportIssues(['The workbook must contain a worksheet named Farms.'])
        return
      }

      const parsed = parseFarmDirectoryImport(farmsSheet.data)
      if (parsed.issues.length > 0) {
        setImportIssues(parsed.issues)
        return
      }

      setPendingImportRows(parsed.rows)
      setConfirmImportOpen(true)
    } catch (error) {
      console.error(error)
      setImportIssues(['The Excel file could not be read. Use the exported Farm Directory workbook.'])
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    const rowsToImport = pendingImportRows
    setConfirmImportOpen(false)
    setImporting(true)
    setImportIssues([])
    setImportMessage(null)

    try {
      const result = await updateFarmDirectoryRows(rowsToImport)
      if (result.failures.length > 0) {
        setImportIssues(result.failures.map(failure =>
          `Row ${failure.rowNumber} (Farm ID ${failure.id}): ${failure.message}`,
        ))
      }
      setImportMessage(
        `${result.updatedCount} ${result.updatedCount === 1 ? 'farm was' : 'farms were'} updated.` +
        (result.failures.length > 0 ? ' No warehouse or warehouse-association data was changed.' : ''),
      )
      setPendingImportRows([])
      await getData()
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The import could not be completed.'
      setImportIssues([detail])
      await getData()
    } finally {
      setImporting(false)
    }
  }

  const tableColumns: Column<RowDataKey>[] = useMemo(
    () => [
      {
        key: 'id',
        label: 'ID',
        searchable: false,
        render: row => (
          <span className="font-mono text-xs text-stone-600">
            {String(row.id)}
          </span>
        ),
      },
      {
        key: 'code',
        label: 'Farm Code',
        render: row => (
          <span className="font-medium text-stone-950">
            {String(row.code || '-')}
          </span>
        ),
      },
      { key: 'name', label: 'Farm Name' },
      {
        key: 'farm_type',
        label: 'Type',
        render: row => {
          const value = String(row.farm_type || '')
          const label = farmTypeLabels[value] ?? value

          if (!label) return '-'

          return (
            <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-700">
              {label}
            </span>
          )
        },
      },
      {
        key: 'approval_status',
        label: 'Approval',
        render: row => {
          const status = String(row.approval_status || 'approved')
          const label = approvalStatusLabels[status] ?? status
          const className =
            status === 'approved'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : status === 'rejected'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'

          return (
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
              {label}
            </span>
          )
        },
      },
      ...FARM_PROFILE_FIELDS.map((field): Column<RowDataKey> => ({
        key: field.code,
        label: field.label,
        render: row => String(row[field.code] || '-'),
      })),
      { key: 'contact_person', label: 'Contact Person', render: row => row.contact_person || '-' },
      { key: 'contact_number', label: 'Contact No.', render: row => row.contact_number || '-' },
      { key: 'remarks', label: 'Remarks', render: row => row.remarks || '-' },
      {
        key: 'action',
        label: 'Action',
        type: 'button',
        align: 'right',
        sortable: false,
        searchable: false,
        render: row => (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/a_dean/farm/${row.id}/edit`)}
              disabled={String(row.approval_status || 'approved') !== 'approved'}
              title={
                String(row.approval_status || 'approved') === 'approved'
                  ? 'Edit farm'
                  : 'Pending or rejected farms cannot be edited'
              }
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [router]
  )

  useEffect(() => {
    getData()
  }, [getData, router])

  useEffect(() => {
    setValue('loading_g', loading)
  }, [loading, setValue])

  return (
    <div>
      <div className="mx-4 mb-4 mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb FirstPreviewsPageName="Settings" CurrentPageName="Farm Management" />
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={loading || exporting || importing}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={loading || importing || exporting}
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {importing ? 'Importing...' : 'Import Excel'}
          </Button>
          <Button variant="secondary" onClick={getData} disabled={loading || importing || exporting}>
            <RefreshCcw className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {(importMessage || importIssues.length > 0) && (
        <Alert className={`mx-4 mb-4 ${importIssues.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          <AlertTitle>{importIssues.length > 0 ? 'Import Needs Attention' : 'Import Complete'}</AlertTitle>
          <AlertDescription className={importIssues.length > 0 ? 'text-amber-800' : 'text-emerald-800'}>
            {importMessage}
            {importIssues.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {importIssues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="mx-4">
        <DynamicTable
          actionsFirst
          loading={loading}
          columns={tableColumns}
          data={initialRows}
          title="Farm Directory"
          description="Maintain farm codes, classifications, contacts, and remarks."
          emptyMessage="No farms found"
          searchPlaceholder="Search farms..."
          rowKey="id"
        />
      </div>

      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update {pendingImportRows.length} {pendingImportRows.length === 1 ? 'farm' : 'farms'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This updates existing approved farms by Farm ID only. Only Farm Directory fields are imported; warehouse records, warehouse associations, and other farm-related records are not changed. Rows are updated independently, so any row-level failures will be reported after processing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmImport()} disabled={importing || pendingImportRows.length === 0}>
              Update Farms
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
