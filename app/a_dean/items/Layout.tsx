

'use client'

import { Button } from '@/components/ui/button'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, FileSpreadsheet, FileUp, Loader2, Plus, RefreshCcw } from 'lucide-react'
import readXlsxFile from 'read-excel-file/browser'

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { addItem, getItemUomGroups, getRecentItems } from './api'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { getItemGroups, getSubItemGroups } from '../itemgroups/api'
import { parseItemMasterImport, type ItemMasterImportRow } from './itemMasterImport'
import { exportItemMasterTemplate } from './itemMasterTemplate'

export default function Layout() {
  const router = useRouter()
  const canInsert = !usePermission('/a_dean/items/insert')
  const canEdit = !usePermission('/a_dean/items/edit')

  const [rows, setRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importIssues, setImportIssues] = useState<string[]>([])
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [pendingImportRows, setPendingImportRows] = useState<ItemMasterImportRow[]>([])
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const columns: ColumnConfig[] = useMemo(
    () => [
      { key: 'item_code', label: 'Item Code', type: 'text', disabled: true },
      { key: 'item_name', label: 'Item Name', type: 'text', disabled: true },
      { key: 'barcode', label: 'Barcode', type: 'text', disabled: true },
      { key: 'unit_measure', label: 'UoM', type: 'text', disabled: true },
      { key: 'item_group', label: 'Group', type: 'text', disabled: true },
      { key: 'fms_group', label: 'FMS Group', type: 'text', disabled: true },
      { key: 'manage_batch_numbers', label: 'Batch', type: 'text', disabled: true },
      { key: 'batch_management_method', label: 'Batch Method', type: 'text', disabled: true },
      { key: 'default_expiration_months', label: 'Exp. Months', type: 'number', disabled: true },
      { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
      { key: 'action', label: 'Action', type: 'button', disabled: false },
    ],
    []
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    const data = await getRecentItems()
    setRows(data as RowDataKey[])
    setLoading(false)
  }, [])

  useEffect(() => {
    router.prefetch('/a_dean/items/new')
    const timer = window.setTimeout(() => {
      fetchData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchData, router])

  const loadImportReferences = async () => {
    const [itemGroups, subItemGroups, uomGroups] = await Promise.all([
      getItemGroups(),
      getSubItemGroups(),
      getItemUomGroups(),
    ])

    return { itemGroups, subItemGroups, uomGroups }
  }

  const handleExportTemplate = async () => {
    setExporting(true)
    setImportIssues([])
    setImportMessage(null)
    try {
      const references = await loadImportReferences()
      await exportItemMasterTemplate(references)
    } catch (error) {
      console.error(error)
      setImportIssues(['Unable to export the Item Master template. Refresh the page and try again.'])
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
      const [sheets, references] = await Promise.all([
        readXlsxFile(file),
        loadImportReferences(),
      ])
      const itemsSheet = sheets.find(sheet => sheet.sheet.trim().toLowerCase() === 'items')
      if (!itemsSheet) {
        setImportIssues(['The workbook must contain a worksheet named Items.'])
        return
      }

      const parsed = parseItemMasterImport(itemsSheet.data, references)
      if (parsed.issues.length > 0) {
        setImportIssues(parsed.issues)
        return
      }

      setPendingImportRows(parsed.rows)
      setConfirmImportOpen(true)
    } catch (error) {
      console.error(error)
      setImportIssues(['The Excel file could not be read. Use the exported Item Master template.'])
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
    let importedCount = 0

    try {
      for (const row of rowsToImport) {
        try {
          await addItem(row.payload)
          importedCount += 1
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Unable to create the item.'
          throw new Error(`Row ${row.rowNumber}: ${detail}`)
        }
      }

      setImportMessage(`${importedCount} ${importedCount === 1 ? 'item was' : 'items were'} imported successfully.`)
      setPendingImportRows([])
      await fetchData()
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The import could not be completed.'
      setImportIssues([
        importedCount > 0
          ? `${importedCount} ${importedCount === 1 ? 'item was' : 'items were'} created before the import stopped. ${detail}`
          : detail,
      ])
      await fetchData()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      {/* 🔹 Header */}
      <div className="mx-4 flex flex-col gap-3 mb-4 mt-4 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="Items"
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={exporting || importing}
            onClick={() => void handleExportTemplate()}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            {exporting ? 'Exporting...' : 'Export Template'}
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
            disabled={!canInsert || importing || exporting}
            onClick={() => importInputRef.current?.click()}
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {importing ? 'Importing...' : 'Import Excel'}
          </Button>
          <Button
            disabled={!canInsert}
            onClick={() => router.push('/a_dean/items/new')}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Item
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

      {/* 🔹 Loading */}
      {loading && (
        <RefreshCcw className="animate-spin mx-auto mt-10" />
      )}

      {/* 🔹 Table */}
      {!loading && (
        <DynamicTable
        loading={loading}
          columns={columns.map((col) => ({
            key: col.key,
            label: col.label,
            align: col.key === 'action' ? 'right' : 'left',

            render: (row: RowDataKey) => {
              if (col.key === 'action') {
                return (
                  <div className="flex  gap-2">
                    <Button
                      variant="outline"
                      disabled={!canEdit}
                      onClick={() => {
                        router.push(
                          `/a_dean/items/edit?id=${row.id}`
                        )
                      }}
                    >
                    <Edit/>  Edit
                    </Button>
                  </div>
                )
              }

              const value = row[col.key]

              if (col.key === 'manage_batch_numbers') {
                return value ? 'Managed' : 'Not managed'
              }

              if (col.key === 'fms_group' && typeof value === 'string') {
                return value.charAt(0).toUpperCase() + value.slice(1)
              }

              if (!value) return '-'

              return String(value)
            },
          }))}

          data={rows}
        />
      )}

      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import {pendingImportRows.length} new {pendingImportRows.length === 1 ? 'item' : 'items'}?</AlertDialogTitle>
            <AlertDialogDescription>
              The workbook passed validation. Item Codes will be generated from each selected Item Group. This import creates new records and does not edit existing items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmImport()} disabled={importing || pendingImportRows.length === 0}>
              Import Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
