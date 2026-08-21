import { USER_TYPE, requireAdminActor } from "@/lib/auth/adminAccess"
import {
  getNotificationActorByToken,
  hasNotificationSetupPermission,
} from "@/lib/data/repositories/notifications.server"
import type { FmsType, NotificationRuleAccess } from "@/lib/notifications/types"

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
}

export async function requireNotificationUser(request: Request) {
  const token = bearerToken(request)
  if (!token) throw new Error("UNAUTHENTICATED")

  const actor = await getNotificationActorByToken(token)
  if (!actor) throw new Error("UNAUTHENTICATED")
  return actor
}

export async function requireNotificationRuleActor(request: Request, action: "view" | "edit") {
  const actor = await requireAdminActor(request)
  if (actor.user_type !== USER_TYPE.SUPER_ADMIN) {
    const allowed = await hasNotificationSetupPermission(actor.auth_id, action)
    if (!allowed) throw new Error("FORBIDDEN")
  }

  return {
    authId: actor.auth_id,
    userType: actor.user_type,
    fmsType: actor.fms_type as FmsType | null,
  } satisfies NotificationRuleAccess
}

export function notificationAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (message === "UNAUTHENTICATED") return { status: 401, message: "Authentication required." }
  if (message === "FORBIDDEN") return { status: 403, message: "You are not allowed to perform this action." }
  return { status: 500, message: "Internal Server Error" }
}
