import { NextResponse } from "next/server"
import { RegistrationError, saveRegistrationProfile, requireRegistrationUser, getAccountAccessByAuthId } from "@/lib/data/repositories/registration.server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? ""
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
    const user = await requireRegistrationUser(token)
    return NextResponse.json(await getAccountAccessByAuthId(user.id), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof RegistrationError ? error.message : "Unable to check your account." },
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
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof RegistrationError ? error.message : "Unable to save personal information." },
      { status: error instanceof RegistrationError ? error.status : error instanceof SyntaxError ? 400 : 500 })
  }
}
