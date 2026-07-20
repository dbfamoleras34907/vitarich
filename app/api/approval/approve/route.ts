export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { decryptValue } from "@/lib/decrypt"

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function findAuthUserIdByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  // Prefer the application profile because it gives us the auth id directly.
  const { data: profile, error: profileError } = await admin_db
    .from("users")
    .select("auth_id")
    .ilike("email", normalizedEmail)
    .limit(1)
    .maybeSingle()

  if (profileError) throw profileError
  if (profile?.auth_id) return profile.auth_id

  // Older accounts may exist in Supabase Auth without a complete public.users profile.
  const perPage = 1000
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin_db.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    )
    if (match) return match.id
    if (data.users.length < perPage) return null
  }
}

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get("authorization")
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : ""

    if (!accessToken) return errorResponse("Your session has expired. Please sign in again.", 401)

    const { data: authData, error: authError } = await admin_db.auth.getUser(accessToken)
    if (authError || !authData.user) {
      return errorResponse("Your session has expired. Please sign in again.", 401)
    }

    const { data: approver, error: approverError } = await admin_db
      .from("users")
      .select("id, issuper")
      .eq("auth_id", authData.user.id)
      .single()

    if (approverError || !approver) return errorResponse("Approver profile not found.", 403)

    const isApprovalAdmin = ["1", "true", "t", "yes"].includes(
      String(approver.issuper ?? "").toLowerCase()
    )
    if (!isApprovalAdmin) return errorResponse("You are not authorized to approve password resets.", 403)

    const body = await req.json()
    const requestId = Number(body.requestId)
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return errorResponse("Invalid approval request id.", 400)
    }

    const { data: request, error: requestError } = await admin_db
      .from("approval_requests")
      .select("id, request_type, status, user_email, value_encrypted")
      .eq("id", requestId)
      .single()

    if (requestError || !request) return errorResponse("Approval request not found.", 404)
    if (request.request_type !== "password_reset") {
      return errorResponse("This endpoint only approves password reset requests.", 400)
    }
    if (request.status !== "pending") {
      return errorResponse(`This request is already ${request.status}.`, 409)
    }
    if (!request.user_email || !request.value_encrypted) {
      return errorResponse("The password reset request is incomplete.", 400)
    }

    const password = decryptValue(request.value_encrypted)
    if (!password) {
      return errorResponse("The requested password could not be decrypted.", 400)
    }

    const targetAuthId = await findAuthUserIdByEmail(request.user_email)
    if (!targetAuthId) {
      return errorResponse(
        `No Supabase Auth login account exists for ${request.user_email.trim()}.`,
        404
      )
    }

    const { error: passwordError } = await admin_db.auth.admin.updateUserById(targetAuthId, {
      password,
    })
    if (passwordError) return errorResponse(passwordError.message, 400)

    const { error: updateError } = await admin_db
      .from("approval_requests")
      .update({
        status: "approved",
        approved_by: approver.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending")

    if (updateError) return errorResponse(updateError.message, 400)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to approve password reset request."
    console.error("Password reset approval error:", error)
    return errorResponse(message, 500)
  }
}
