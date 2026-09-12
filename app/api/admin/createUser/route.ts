export const runtime = "nodejs"
import { after, NextResponse } from "next/server"
import { USER_TYPE, adminAccessError, requireAdminActor } from "@/lib/auth/adminAccess"
import { createRegistrationAccount, RegistrationError } from "@/lib/data/repositories/registration.server"
import { processPendingNotificationEvents } from "@/lib/data/repositories/notifications.server"
import { processPendingNotificationEmails } from "@/lib/notifications/processEmailDeliveries.server"

export async function POST(req: Request) {
  try {
    const actor = await requireAdminActor(req)
    const input = await req.json()
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new RegistrationError("Invalid account details.")
    const user = await createRegistrationAccount(input, { authId: actor.auth_id, fmsType: actor.user_type === USER_TYPE.ADMIN ? actor.fms_type : null })
    after(async () => {
      try {
        await processPendingNotificationEvents(50)
        await processPendingNotificationEmails(20)
      } catch (error) { console.error("Registration notification processing failed:", error) }
    })
    return NextResponse.json({ user })
  } catch (error) {
    const response = error instanceof RegistrationError ? { status: error.status, message: error.message } : adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
