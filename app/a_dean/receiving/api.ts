import { db } from '@/lib/Supabase/supabaseClient'
import { DocumentApproval, ReceivingItemRow, ReceivingListRow, ReceivingListRow2 } from '@/lib/types'

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



// export async function getReceivingList(): Promise<ReceivingItemRow[]> {
//   const { data, error } = await db
//     .from('recieving')
//     .select(`
//       id,
//       recieving_items (*)
//     `)
//     .order('created_at', { ascending: false })

//   if (error) throw error

//   return data as ReceivingItemRow[]
// }

export async function getReceivingList(): Promise<ReceivingListRow2[]> {
  const { data, error } = await db
    .from('vwdmf_getreceived')
    .select(`*
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data as ReceivingListRow2[]
}

// get user where supervisor is not null
export async function getReceivingListByUser(): Promise<string> {
  // get session
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('auth_id', sessionData.session?.user.id)
    .not('supervisor', 'is', null)
  console.log({ data })
  console.log({ error })
  console.log(sessionData.session?.user.id)

  return data?.[0]?.id || '';
}