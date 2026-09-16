import { db } from '@/lib/Supabase/supabaseClient'
import type { BreederDispatchInput } from '@/app/jmb/breederdispatch/new/api'

export async function saveBreederDispatchTransaction(id: number | null, input: BreederDispatchInput, documentNo: string | null, post: boolean) {
  const { data, error } = await db.rpc('save_breeder_dispatch_transaction', {
    p_id: id, p_payload: { ...input, document_no: documentNo }, p_post: post,
  })
  if (error) throw error
  return Number(data)
}
