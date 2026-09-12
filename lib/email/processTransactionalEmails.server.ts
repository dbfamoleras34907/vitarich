import "server-only"
import { sendEmail } from "@/email"
import { claimTransactionalEmails, finishTransactionalEmail } from "@/lib/data/repositories/transactionalEmails.server"
import { buildAccountDecisionEmail } from "./accountDecisionTemplate"
import { getEmailSenderAddress } from "./config.server"

export async function processTransactionalEmails(limit = 20) {
  const emails = await claimTransactionalEmails(limit)
  let sent = 0
  let failed = 0
  for (const email of emails) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || ""
      const content = buildAccountDecisionEmail(email.template_key, email.payload.reason ?? "", siteUrl)
      const domain = getEmailSenderAddress().split("@")[1] || "vitafms.local"
      const result = await sendEmail({ to: email.recipient_email, ...content, fromName: "Vita FMS", messageId: `<account-${email.id}@${domain}>` })
      if (!result.success) throw result.error
      await finishTransactionalEmail(email, true)
      sent += 1
    } catch (error) {
      await finishTransactionalEmail(email, false, (error instanceof Error ? error.message : "Email delivery failed.").slice(0, 2000))
      failed += 1
    }
  }
  return { claimed: emails.length, sent, failed }
}
