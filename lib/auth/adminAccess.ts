import { admin_db } from "@/lib/Supabase/supabaseAdmin"

export const USER_TYPE = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  USER: 3,
} as const

export type ManagedUserProfile = {
  id: number
  auth_id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  fms_type: string | null
  user_type: number
  issuper: string | null
}

export async function requireAdminActor(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""

  if (!token) throw new Error("UNAUTHENTICATED")

  const { data: authData, error: authError } = await admin_db.auth.getUser(token)
  if (authError || !authData.user?.id) throw new Error("UNAUTHENTICATED")

  const { data, error } = await admin_db
    .from("users")
    .select("id, auth_id, email, firstname, lastname, fms_type, user_type, issuper")
    .eq("auth_id", authData.user.id)
    .single()

  if (error || !data) throw new Error("FORBIDDEN")

  const actor = {
    ...data,
    user_type: Number(data.user_type ?? USER_TYPE.USER),
  } as ManagedUserProfile

  if (![USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN].includes(actor.user_type as 1 | 2)) {
    throw new Error("FORBIDDEN")
  }

  return actor
}

export function canManageUser(actor: ManagedUserProfile, target: ManagedUserProfile) {
  if (actor.user_type === USER_TYPE.SUPER_ADMIN) return true

  return target.user_type === USER_TYPE.USER
    && Boolean(actor.fms_type)
    && actor.fms_type === target.fms_type
}

export function adminAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (message === "UNAUTHENTICATED") return { status: 401, message: "Authentication required." }
  if (message === "FORBIDDEN") return { status: 403, message: "You are not allowed to perform this action." }
  return { status: 500, message: "Internal Server Error" }
}
