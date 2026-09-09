'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, MoreHorizontal, Pencil, Plus, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import DynamicTable, { type Column } from '@/components/ui/DataTableV2'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { usePermission } from '@/hooks/usePermission'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import { getVnmDocuments, type VnmDocument } from '@/lib/data/repositories/vaccinationMeds'

type VnmListRow = Record<string, unknown> & {
  id: number
  documentNo: string
  farm: string
  cycle: string
  createdDate: string
  warehouse: string
  medication: string
  quantity: number
  status: string
}

export default function VnmList() {
  const router = useRouter()
  const { setCollapsed } = useSidebar()
  const cannotView = usePermission('/vnm/view')
  const cannotInsert = usePermission('/vnm/insert')
  const cannotEdit = usePermission('/vnm/edit')
  const [documents, setDocuments] = useState<VnmDocument[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setDocuments(await getVnmDocuments()) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Vaccination and Meds documents could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { router.prefetch('/vnm/new'); void refresh() }, [refresh, router])

  const rows = useMemo<VnmListRow[]>(() => documents.map(document => ({
    id: Number(document.id), documentNo: document.documentNo, farm: document.farmName || document.farmCode,
    cycle: document.fmsType === 'Breeder' ? 'N/A' : document.cycleNo ? String(document.cycleNo) : '-', createdDate: document.createdDate,
    warehouse: document.storageWarehouseName || document.storageWarehouseCode,
    medication: document.lines.length === 0 ? '-' : document.lines.length === 1 ? document.lines[0].medicationName : `${document.lines[0].medicationName} +${document.lines.length - 1} more`,
    quantity: document.lines.reduce((total, line) => total + Number(line.baseQuantity || 0), 0), status: document.status,
  })), [documents])

  const columns = useMemo<Column<VnmListRow>[]>(() => [
    { key: 'documentNo', label: 'VM No.', editable: false, render: row => <span className="rounded-md bg-sidebar-accent px-2 py-1 font-semibold">{row.documentNo}</span> },
    { key: 'farm', label: 'Farm', editable: false }, { key: 'cycle', label: 'Cycle', editable: false }, { key: 'createdDate', label: 'Created Date', editable: false },
    { key: 'warehouse', label: 'Medication Storage', editable: false }, { key: 'medication', label: 'Medication', editable: false },
    { key: 'quantity', label: 'Base Qty', align: 'center', editable: false },
    { key: 'status', label: 'Status', align: 'center', editable: false, render: row => <span className={getInventoryStatusBadgeClass(row.status)}>{row.status}</span> },
    { key: 'actions', label: 'Action', type: 'button', sortable: false, searchable: false, editable: false, render: row => <div onClick={event => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="outline" aria-label={`Actions for ${row.documentNo}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={cannotView} onSelect={() => router.push(`/vnm/view/${row.id}`)}><Eye className="size-4" />View</DropdownMenuItem>{row.status === 'Draft' && <DropdownMenuItem disabled={cannotEdit} onSelect={() => router.push(`/vnm/edit/${row.id}`)}><Pencil className="size-4" />Edit Draft</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div> },
  ], [cannotEdit, cannotView, router])

  return <main className="min-h-[calc(100vh-4rem)] text-stone-950">
    <div className="mt-2 flex items-center justify-between gap-3"><Breadcrumb FirstPreviewsPageName="Animal Health" CurrentPageName="Vaccination and Meds" /><div className="flex gap-2"><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button disabled={cannotInsert} onClick={() => { setCollapsed(true); router.push('/vnm/new') }}><Plus className="size-4" />New VM</Button></div></div>
    <div className="mt-4 overflow-x-auto"><DynamicTable ExcelTable={true} frozenColumns={1} excelRowActions={false} loading={loading} initialFilters={[]} title="Vaccination and Meds" description={`${rows.length} document(s)`} columns={columns} data={rows} rowKey={row => row.id} searchPlaceholder="Search Vaccination and Meds..." emptyMessage="No Vaccination and Meds documents found" noResultsMessage="No matching documents found" onRowClick={row => { if (!cannotView) router.push(`/vnm/view/${row.id}`) }} /></div>
  </main>
}
