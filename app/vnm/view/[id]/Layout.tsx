'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Ban, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import DynamicTable, { type Column } from '@/components/ui/DataTableV2'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/usePermission'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import { getVnmDocument, voidVnmDocument, type VnmDocument, type VnmLine } from '@/lib/data/repositories/vaccinationMeds'

const Detail = ({ label, value }: { label: string; value: unknown }) => <div><div className="text-xs font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium">{String(value ?? '-') || '-'}</div></div>

type VnmViewLine = VnmLine & Record<string, unknown> & { lineNo: number }

const lineColumns: Column<VnmViewLine>[] = [
  { key: 'lineNo', label: '#', width: 60, align: 'center', editable: false },
  { key: 'buildingName', label: 'Building', width: 180, editable: false, render: row => row.buildingName || row.buildingCode },
  { key: 'penName', label: 'Pen', width: 160, editable: false, render: row => row.penName || row.penCode || 'N/A' },
  { key: 'treatmentDate', label: 'Treatment Start', width: 145, editable: false },
  { key: 'treatmentPeriodDays', label: 'Days', width: 85, align: 'center', editable: false },
  { key: 'medicationCode', label: 'Medication', width: 250, editable: false, render: row => <div><div className="font-medium">{row.medicationCode}</div><div className="text-xs text-muted-foreground">{row.medicationName}</div></div> },
  { key: 'medicationType', label: 'Medication Type', width: 175, editable: false },
  { key: 'quantity', label: 'Quantity', width: 125, editable: false, render: row => `${row.quantity} ${row.uom}` },
  { key: 'baseQuantity', label: 'Base Quantity', width: 145, editable: false, render: row => `${row.baseQuantity} ${row.baseUom}` },
  { key: 'allocations', label: 'Batch Allocation', width: 260, editable: false, render: row => row.allocations.map(value => `${value.batchNumber || 'No batch'} [${value.baseQty}]`).join(', ') },
  { key: 'indication', label: 'Indication', width: 180, editable: false },
  { key: 'route', label: 'Route', width: 160, editable: false },
  { key: 'birdQuantityTreated', label: 'Bird Qty Treated', width: 145, editable: false, render: row => row.birdQuantityTreated ?? '-' },
  { key: 'administeredBy', label: 'Administered By', width: 175, editable: false, render: row => row.administeredBy || '-' },
  { key: 'withdrawalPeriodDays', label: 'Withdrawal Days', width: 145, editable: false, render: row => row.withdrawalPeriodDays ?? '-' },
  { key: 'remarks', label: 'Remarks', width: 220, editable: false, render: row => row.remarks || '-' },
]

export default function VnmView({ documentId }: { documentId: number }) {
  const router = useRouter()
  const cannotEdit = usePermission('/vnm/edit')
  const cannotVoid = usePermission('/vnm/void')
  const [document, setDocument] = useState<VnmDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [voiding, setVoiding] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setDocument(await getVnmDocument(documentId)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'The document could not be loaded.') }
    finally { setLoading(false) }
  }, [documentId])
  useEffect(() => { void load() }, [load])

  const voidDocument = async () => {
    if (!document?.id || !window.confirm(`Void ${document.documentNo} and restore its exact inventory quantities?`)) return
    setVoiding(true)
    try { setDocument(await voidVnmDocument(document.id, crypto.randomUUID())); toast.success(`${document.documentNo} voided and inventory restored.`) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'The document could not be voided.') }
    finally { setVoiding(false) }
  }

  if (loading) return <main className="p-6 text-sm text-muted-foreground">Loading Vaccination and Meds...</main>
  if (!document) return <main className="p-6"><Button variant="outline" onClick={() => router.push('/vnm')}><ArrowLeft className="size-4" />Back</Button><p className="mt-6 text-sm">Document not found or unavailable.</p></main>

  return <main className="mx-auto max-w-[1800px] space-y-3 p-3 sm:p-4">
    <Breadcrumb FirstPreviewsPageName="Animal Health" FirstPreviewsPageLink="/vnm" SecondPreviewPageName="Vaccination and Meds" SecondPreviewPageLink="/vnm" CurrentPageName={document.documentNo} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div><h1 className="text-xl font-semibold">{document.documentNo}</h1><p className="text-sm text-muted-foreground">Vaccination and Meds document</p></div><span className={getInventoryStatusBadgeClass(document.status)}>{document.status}</span></div><div className="flex gap-2"><Button variant="outline" onClick={() => router.push('/vnm')}><ArrowLeft className="size-4" />Back</Button>{document.status === 'Draft' && <Button disabled={cannotEdit} onClick={() => router.push(`/vnm/edit/${document.id}`)}><Pencil className="size-4" />Edit Draft</Button>}{document.status === 'Posted' && <Button variant="destructive" disabled={cannotVoid || voiding} onClick={() => void voidDocument()}><Ban className="size-4" />{voiding ? 'Voiding...' : 'Void'}</Button>}</div></div>
    <section className="rounded-md border bg-white p-4"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Farm" value={`${document.farmCode} - ${document.farmName}`} /><Detail label="FMS Type" value={document.fmsType} /><Detail label="Farm Cycle" value={document.fmsType === 'Breeder' ? 'Not applicable' : document.cycleNo} /><Detail label="Created Date" value={document.createdDate} /><Detail label="Medication Storage" value={`${document.storageWarehouseCode} - ${document.storageWarehouseName}`} /><div className="lg:col-span-3"><Detail label="Remarks" value={document.remarks} /></div></div></section>
    <section className="rounded-md border bg-white"><div className="overflow-x-auto"><DynamicTable<VnmViewLine> ExcelTable={true} frozenColumns={1} excelRowActions={false} loading={false} columns={lineColumns} data={document.lines.map((line, index) => ({ ...line, lineNo: index + 1 }))} rowKey={row => String(row.id)} title="Medication Usage Lines" description={`${document.lines.length} line(s)`} enableSearch={false} enableFilters={false} enablePagination={false} emptyMessage="No medication usage lines" /></div></section>
  </main>
}
