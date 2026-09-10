import { NextResponse } from "next/server"
import { createRegistrationAccount, RegistrationError } from "@/lib/data/repositories/registration.server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RegistrationError("Invalid registration details.")
    await createRegistrationAccount(body)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof RegistrationError ? error.message : "Unable to register your account." },
      { status: error instanceof RegistrationError ? error.status : error instanceof SyntaxError ? 400 : 500 })
  }
}
