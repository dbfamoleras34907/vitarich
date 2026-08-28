import { db } from '@/lib/Supabase/supabaseClient'

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
