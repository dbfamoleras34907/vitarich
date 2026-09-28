import { db } from '@/lib/Supabase/supabaseClient'
import { DocumentApproval } from '@/lib/types'

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



// export { getReceivingList } from '@/lib/data/repositories/receivingLists'

// get user where supervisor is not null
export async function getReceivingListByUser(): Promise<string> {
  // get session
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError
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






export { vwdmf_get_farmdr_unres } from '@/lib/data/repositories/receivingLists'
