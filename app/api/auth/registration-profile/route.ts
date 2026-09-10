import { after, NextResponse } from "next/server"
import { RegistrationError, saveRegistrationProfile, listRegistrationFarms } from "@/lib/data/repositories/registration.server"
import { processPendingNotificationEvents } from "@/lib/data/repositories/notifications.server"
import { processPendingNotificationEmails } from "@/lib/notifications/processEmailDeliveries.server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? ""
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
    return NextResponse.json({ farms: await listRegistrationFarms(token) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof RegistrationError ? error.message : "Unable to load farms." },
      { status: error instanceof RegistrationError ? error.status : 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? ""
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
    const body = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RegistrationError("Invalid personal information.")
    await saveRegistrationProfile(token, body)
    after(async () => {
      try {
        await processPendingNotificationEvents(50)
        await processPendingNotificationEmails(20)
      } catch (error) {
        // Persistence already succeeded; the durable queue remains retryable.
        console.error("Unable to process registration notifications:", error)
      }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof RegistrationError ? error.message : "Unable to save personal information." },
      { status: error instanceof RegistrationError ? error.status : error instanceof SyntaxError ? 400 : 500 })
  }
}
