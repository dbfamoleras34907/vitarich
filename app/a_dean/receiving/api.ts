import { db } from '@/lib/Supabase/supabaseClient'
import { DocumentApproval, ReceivingListRow } from '@/lib/types'

export async function getReceivingDraftPending() {
  const { data, error } = await db
    .from('vwdmf_receiving_draft_pending')
    .select('*')
  // .order('posting_date', { ascending: false })

  if (error) {
    throw error
  }

  return data as DocumentApproval[]
}




export async function getReceivingList(): Promise<ReceivingListRow[]> {
  const { data, error } = await db
    .from('vwdmf_receiving_list')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return data as ReceivingListRow[]
}