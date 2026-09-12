import { db } from '@/lib/Supabase/supabaseClient'
import type { GoodsIssue } from '@/app/inv/gi/api'

function cleanupDatabaseError(error: { code?: string; message?: string; details?: string; hint?: string }): Error {
  if (error.code === 'PGRST202') {
    return new Error('Clean Up needs a database update before it can load or save. Ask your administrator to install the Clean Up update, then retry.')
  }
  return new Error([error.message, error.details, error.hint].filter(Boolean).join(' ') || 'Unable to access Clean Up data.')
}

export type BrCleanupDraftIdentity = {
  id: number
  status: string
  createdBy: string | null
}

export async function getBrCleanupIdentityByDocumentNo(
  documentNo: string,
): Promise<BrCleanupDraftIdentity | null> {
  const normalizedDocumentNo = documentNo.trim()
  if (!normalizedDocumentNo) return null

  const { data, error } = await db
    .from('br_cleanup')
    .select('id, status, created_by')
    .eq('gi_no', normalizedDocumentNo)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: Number(data.id),
    status: String(data.status ?? ''),
    createdBy: data.created_by ?? null,
  }
}

export async function getHarvestEmptiedCleanupBatches(flockCardId: number) {
  const { data, error } = await db.rpc('get_harvest_emptied_cleanup_batches', {
    p_flock_card_id: flockCardId,
  })
  if (error) throw cleanupDatabaseError(error)
  return (data ?? []) as {
    item_code: string
    item_name: string
    batch_number: string
    warehouse_code: string
  }[]
}

export async function saveBroilerCleanup(issue: GoodsIssue) {
  const { data, error } = await db.rpc('save_br_cleanup_transaction', {
    p_document: { ...issue, lines: issue.lines },
  })
  if (error) throw cleanupDatabaseError(error)
  return data as { header: unknown; lines: unknown[] } | null
}
