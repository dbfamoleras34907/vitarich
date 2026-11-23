import { db } from '@/lib/Supabase/supabaseClient'

export type BatchTransactionTrail = {
  id: number
  sourceDocType: string
  sourceDocEntry: number
  documentLabel: string
  itemCode: string
  warehouseCode: string
  binCode: string
  qty: number
  signedQty: number
  runningQty: number
  warehouseRunningQty: number
  transferType: string
  refType: string
  ref: string
  refType2: string
  ref2: string
  createdAt: string
}

type InventoryPostingBatchRow = {
  id: number
  source_doc_type?: string | null
  source_docentry?: number | null
  item_code: string | null
  warehouse_code: string | null
  bin_code?: string | null
  qty: number | null
  transfer_type: string | null
  batch_number?: string | null
  ref_type?: string | null
  ref: string | null
  ref_type2?: string | null
  ref2: string | null
  created_at?: string | null
}

type SourceDocumentRow = {
  id: number
  gr_no?: string | null
  gi_no?: string | null
}

const signedPostingQty = (row: InventoryPostingBatchRow) => {
  const qty = Number(row.qty ?? 0)
  return row.transfer_type === 'OUT' ? -qty : qty
}

const dedupePostings = (rows: InventoryPostingBatchRow[]) => {
  const seenPostingIds = new Set<number>()
  return rows.filter(row => {
    if (seenPostingIds.has(row.id)) return false
    seenPostingIds.add(row.id)
    return true
  })
}

const getPostingBatchReference = (row: InventoryPostingBatchRow, normalizedBatchNumber: string) => {
  const batchNumber = String(row.batch_number ?? '').trim()
  const ref = String(row.ref ?? '').trim()
  const ref2 = String(row.ref2 ?? '').trim()

  // A DOC consolidation OUT consumes the original source batch. Its ref2
  // points to the resulting canonical DOC:F... batch for lineage only, so it
  // must not reduce that canonical batch's inventory trail.
  const sourceDocType = String(row.source_doc_type ?? '').trim().toUpperCase()
  const transferType = String(row.transfer_type ?? '').trim().toUpperCase()
  if (sourceDocType === 'DOC_RECEIVING_CONSOLIDATION' && transferType === 'OUT' && ref) {
    return ref.toUpperCase() === normalizedBatchNumber ? ref : ''
  }

  // The persisted batch number is authoritative. References describe how a
  // posting relates to another batch/document and are legacy fallbacks only.
  if (batchNumber) return batchNumber.toUpperCase() === normalizedBatchNumber ? batchNumber : ''
  if (ref) return ref.toUpperCase() === normalizedBatchNumber ? ref : ''
  if (ref2) return ref2.toUpperCase() === normalizedBatchNumber ? ref2 : ''
  return ''
}

const postingTime = (row: InventoryPostingBatchRow) => {
  const value = Date.parse(String(row.created_at ?? ''))
  return Number.isFinite(value) ? value : 0
}

const documentKey = (sourceDocType: string, sourceDocEntry: number) =>
  `${sourceDocType.toUpperCase()}|${sourceDocEntry}`

export async function getBatchTransactionTrail(
  itemCode: string,
  batchNumber: string,
): Promise<BatchTransactionTrail[]> {
  const normalizedItemCode = itemCode.trim()
  const normalizedBatchNumber = batchNumber.trim()
  if (!normalizedItemCode || !normalizedBatchNumber) return []

  const postingSelect = 'id, source_doc_type, source_docentry, item_code, warehouse_code, bin_code, qty, transfer_type, batch_number, ref_type, ref, ref_type2, ref2, created_at'
  const buildPostingQuery = (field: 'batch_number' | 'ref' | 'ref2') =>
    db
      .from('inventory_postings')
      .select(postingSelect)
      .eq('item_code', normalizedItemCode)
      .eq(field, normalizedBatchNumber)

  const [batchPostingsResult, refPostingsResult, ref2PostingsResult] = await Promise.all([
    buildPostingQuery('batch_number'),
    buildPostingQuery('ref'),
    buildPostingQuery('ref2'),
  ])

  if (batchPostingsResult.error) throw batchPostingsResult.error
  if (refPostingsResult.error) throw refPostingsResult.error
  if (ref2PostingsResult.error) throw ref2PostingsResult.error

  const normalizedBatchKey = normalizedBatchNumber.toUpperCase()
  const postings = dedupePostings([
    ...((batchPostingsResult.data ?? []) as InventoryPostingBatchRow[]),
    ...((refPostingsResult.data ?? []) as InventoryPostingBatchRow[]),
    ...((ref2PostingsResult.data ?? []) as InventoryPostingBatchRow[]),
  ])
    .filter(row => getPostingBatchReference(row, normalizedBatchKey))
    .sort((left, right) => {
      return postingTime(left) - postingTime(right) || Number(left.id) - Number(right.id)
    })

  if (postings.length === 0) return []

  const idsFor = (sourceTypes: string[]) => Array.from(new Set(
    postings
      .filter(row => sourceTypes.includes(String(row.source_doc_type ?? '').toUpperCase()))
      .map(row => Number(row.source_docentry ?? 0))
      .filter(id => Number.isFinite(id) && id > 0),
  ))
  const receiptIds = idsFor(['GOODS_RECEIPT'])
  const issueIds = idsFor(['GOODS_ISSUE'])
  const deliveryIds = idsFor(['BR_DELIVERY'])
  const cleanupIds = idsFor([
    'BR_CLEANUP',
    'BR_CLEANUP_VARIANCE',
    'BR_CLEANUP_REVERSAL',
    'BR_CLEANUP_VARIANCE_REVERSAL',
  ])
  const documentLabelsByKey = new Map<string, string>()

  if (receiptIds.length > 0) {
    const { data, error } = await db.from('goods_receipt').select('id, gr_no').in('id', receiptIds)
    if (error) throw error
    for (const receipt of (data ?? []) as SourceDocumentRow[]) {
      documentLabelsByKey.set(documentKey('GOODS_RECEIPT', receipt.id), receipt.gr_no || `GR #${receipt.id}`)
    }
  }

  if (issueIds.length > 0) {
    const { data, error } = await db.from('goods_issue').select('id, gi_no').in('id', issueIds)
    if (error) throw error
    for (const issue of (data ?? []) as SourceDocumentRow[]) {
      documentLabelsByKey.set(documentKey('GOODS_ISSUE', issue.id), issue.gi_no || `GI #${issue.id}`)
    }
  }

  if (deliveryIds.length > 0) {
    const { data, error } = await db.from('br_delivery').select('id, gi_no').in('id', deliveryIds)
    if (error) throw error
    for (const delivery of (data ?? []) as SourceDocumentRow[]) {
      documentLabelsByKey.set(documentKey('BR_DELIVERY', delivery.id), delivery.gi_no || `BR-DR #${delivery.id}`)
    }
  }

  if (cleanupIds.length > 0) {
    const { data, error } = await db.from('goods_issue').select('id, gi_no').in('id', cleanupIds)
    if (error) throw error
    for (const cleanup of (data ?? []) as SourceDocumentRow[]) {
      const label = cleanup.gi_no || `BR-CU #${cleanup.id}`
      for (const sourceType of ['BR_CLEANUP', 'BR_CLEANUP_VARIANCE', 'BR_CLEANUP_REVERSAL', 'BR_CLEANUP_VARIANCE_REVERSAL']) {
        documentLabelsByKey.set(documentKey(sourceType, cleanup.id), label)
      }
    }
  }

  let runningQty = 0
  const runningQtyByWarehouse = new Map<string, number>()
  return postings.map(row => {
    const sourceDocType = String(row.source_doc_type ?? '')
    const sourceDocEntry = Number(row.source_docentry ?? 0)
    const signedQty = signedPostingQty(row)
    const warehouseCode = String(row.warehouse_code ?? '')
    const warehouseKey = warehouseCode.trim().toUpperCase()
    runningQty += signedQty
    const warehouseRunningQty = (runningQtyByWarehouse.get(warehouseKey) ?? 0) + signedQty
    runningQtyByWarehouse.set(warehouseKey, warehouseRunningQty)

    return {
      id: row.id,
      sourceDocType,
      sourceDocEntry,
      documentLabel: documentLabelsByKey.get(documentKey(sourceDocType, sourceDocEntry)) || `${sourceDocType || 'Document'} #${sourceDocEntry || '-'}`,
      itemCode: String(row.item_code ?? ''),
      warehouseCode,
      binCode: String(row.bin_code ?? ''),
      qty: Number(row.qty ?? 0),
      signedQty,
      runningQty,
      warehouseRunningQty,
      transferType: String(row.transfer_type ?? ''),
      refType: String(row.ref_type ?? ''),
      ref: String(row.ref ?? ''),
      refType2: String(row.ref_type2 ?? ''),
      ref2: String(row.ref2 ?? ''),
      createdAt: String(row.created_at ?? ''),
    }
  })
}
