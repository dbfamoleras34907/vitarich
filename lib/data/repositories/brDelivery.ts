import { db } from '@/lib/Supabase/supabaseClient'

export async function reverseBroilerDelivery(documentId: number, reason: string): Promise<void> {
  const { error } = await db.rpc('reverse_br_delivery_transaction', {
    p_delivery_id: documentId,
    p_reason: reason.trim(),
  })
  if (error?.code === 'PGRST202') {
    throw new Error('Harvest reversal needs a database update. Apply the Harvest & Delivery reversal migration, then retry.')
  }
  if (error) throw new Error([error.message, error.details, error.hint].filter(Boolean).join(' '))
}
