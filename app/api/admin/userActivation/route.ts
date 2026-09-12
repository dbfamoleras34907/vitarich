export const runtime = "nodejs"

import { after, NextResponse } from "next/server"
import { requireAdminActor, adminAccessError } from "@/lib/auth/adminAccess"
import { RegistrationError } from "@/lib/data/repositories/registration.server"
import { listPendingActivations, decideRegistration } from "@/lib/data/repositories/userActivation.server"
import { processPendingNotificationEvents } from "@/lib/data/repositories/notifications.server"
import { processPendingNotificationEmails } from "@/lib/notifications/processEmailDeliveries.server"
import { processTransactionalEmails } from "@/lib/email/processTransactionalEmails.server"

function failure(error: unknown) {
  const result = error instanceof RegistrationError ? { status: error.status, message: error.message } : adminAccessError(error)
  return NextResponse.json({ error: result.message }, { status: result.status })
}

export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor(request)
    return NextResponse.json({ users: await listPendingActivations(actor) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActor(request)
    const input = await request.json()
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new RegistrationError("Invalid decision.")
    const user = await decideRegistration(actor, input)
    after(async () => {
      const results = await Promise.allSettled([
        processTransactionalEmails(20),
        processPendingNotificationEvents(50).then(() => processPendingNotificationEmails(20)),
      ])
      for (const result of results) if (result.status === "rejected") console.error("Account notification processing failed:", result.reason)
    })
    return NextResponse.json({ user })
  } catch (error) { return failure(error) }
}
