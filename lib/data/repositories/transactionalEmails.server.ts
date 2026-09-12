import "server-only"
import { admin_db } from "@/lib/Supabase/supabaseAdmin"

export type TransactionalEmail = {
  id: string; lease_id: string; recipient_email: string
  template_key: "ACCOUNT_ACTIVATED" | "ACCOUNT_REJECTED"
  payload: { reason?: string }
}

export async function claimTransactionalEmails(limit: number) {
  const { data, error } = await admin_db.rpc("claim_transactional_emails", { p_limit: limit })
  if (error) throw error
  return (data ?? []) as TransactionalEmail[]
}

export async function finishTransactionalEmail(email: TransactionalEmail, success: boolean, errorMessage: string | null = null) {
  const { error } = await admin_db.rpc("finish_transactional_email", {
    p_id: email.id, p_lease_id: email.lease_id, p_success: success, p_error: errorMessage,
  })
  if (error) throw error
}

export async function retryFailedTransactionalEmails() {
  const { error } = await admin_db.from("transactional_email_outbox")
    .update({ next_attempt_at: new Date().toISOString() }).eq("status", "failed")
  if (error) throw error
}
