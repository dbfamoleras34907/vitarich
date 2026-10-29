export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { USER_TYPE, adminAccessError, requireAdminActor } from "@/lib/auth/adminAccess"
import { createRegistrationAccount, RegistrationError } from "@/lib/data/repositories/registration.server"
import { normalizeUserFmsTypes } from "@/lib/auth/fmsAccess"

export async function POST(req: Request) {
  try {
    const actor = await requireAdminActor(req)
    const input = await req.json()
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new RegistrationError("Invalid account details.")
    const user = await createRegistrationAccount(input, {
      authId: actor.auth_id,
      fmsTypes: actor.user_type === USER_TYPE.ADMIN ? normalizeUserFmsTypes(actor.fms_types, actor.fms_type) : [],
    })
    return NextResponse.json({ user })
  } catch (error) {
    const response = error instanceof RegistrationError ? { status: error.status, message: error.message } : adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
