import { db } from '@/lib/Supabase/supabaseClient'
import { DisposalPrintRow } from '@/lib/types'

export async function getDisposalPrint(
  id: number
): Promise<DisposalPrintRow[]> {

  const { data, error } = await db.rpc(
    'fndmf_get_disposal_print',
    { p_id: id }
  )

  if (error) {
    console.error('Error fetching disposal print:', error)
    throw new Error(error.message)
  }

  return (data ?? []) as DisposalPrintRow[]
}