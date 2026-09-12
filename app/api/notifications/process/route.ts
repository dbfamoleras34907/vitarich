export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { notificationAccessError, requireNotificationRuleActor, requireNotificationUser } from "@/lib/auth/notificationAccess"
import { makeFailedNotificationEmailsRetryable, processPendingNotificationEvents } from "@/lib/data/repositories/notifications.server"
import { processPendingNotificationEmails } from "@/lib/notifications/processEmailDeliveries.server"
import { processTransactionalEmails } from "@/lib/email/processTransactionalEmails.server"
import { retryFailedTransactionalEmails } from "@/lib/data/repositories/transactionalEmails.server"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { retryFailedEmails?: unknown }
    const retryFailedEmails = body.retryFailedEmails === true
    if (retryFailedEmails) await requireNotificationRuleActor(request, "edit")
    else await requireNotificationUser(request)

    const requeued = retryFailedEmails ? await makeFailedNotificationEmailsRetryable() : 0
    if (retryFailedEmails) await retryFailedTransactionalEmails()
    const accountEmails = await processTransactionalEmails(20)
    const processed = await processPendingNotificationEvents(50)
    const emails = await processPendingNotificationEmails(20)
    return NextResponse.json({ processed, emails: { ...emails, requeued }, accountEmails })
  } catch (error) {
    const response = notificationAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
