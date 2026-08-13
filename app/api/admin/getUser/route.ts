export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { USER_TYPE, adminAccessError, requireAdminActor } from "@/lib/auth/adminAccess"

export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor(request)
    let query = admin_db.from("users").select("*").order("email", { ascending: true })

    if (actor.user_type === USER_TYPE.ADMIN) {
      query = query.eq("user_type", USER_TYPE.USER).eq("fms_type", actor.fms_type)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ user: data ?? [] })
  } catch (error) {
    const response = adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
