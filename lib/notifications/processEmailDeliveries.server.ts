import "server-only"

import { sendEmail } from "@/email"
import { getEmailSenderAddress, isNotificationEmailExcluded } from "@/lib/email/config.server"
import {
  claimPendingNotificationEmails,
  completeNotificationEmailDelivery,
  skipNotificationEmailDelivery,
} from "@/lib/data/repositories/notifications.server"
import { buildNotificationEmail } from "./emailTemplate"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 2000)
  return String(error ?? "Email delivery failed.").slice(0, 2000)
}

function deliveryMessageId(eventId: string, recipientAuthId: string) {
  const sender = getEmailSenderAddress()
  const domain = sender.includes("@") ? sender.split("@").pop() : "vitafms.local"
  return `<notification-${eventId}-${recipientAuthId}@${domain}>`
}

export async function processPendingNotificationEmails(limit = 20) {
  const deliveries = await claimPendingNotificationEmails(limit)
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const delivery of deliveries) {
    try {
      if (!delivery.recipient_email) throw new Error("Recipient email is missing.")
      if (isNotificationEmailExcluded(delivery.recipient_email)) {
        await skipNotificationEmailDelivery(delivery.id, "Recipient email is excluded from notification email delivery.")
        skipped += 1
        continue
      }

      const email = buildNotificationEmail(delivery)
      const result = await sendEmail({
        to: delivery.recipient_email,
        subject: email.subject,
        html: email.html,
        fromName: "Vita FMS",
        messageId: deliveryMessageId(delivery.event_id, delivery.recipient_auth_id),
      })

      if (!result.success) throw result.error

      await completeNotificationEmailDelivery({
        id: delivery.id,
        success: true,
        providerMessageId: result.messageId,
      })
      sent += 1
    } catch (error) {
      await completeNotificationEmailDelivery({
        id: delivery.id,
        success: false,
        error: errorMessage(error),
      })
      failed += 1
    }
  }

  return { claimed: deliveries.length, sent, failed, skipped }
}
