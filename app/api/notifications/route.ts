export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { notificationAccessError, requireNotificationUser } from "@/lib/auth/notificationAccess"
import {
  getUserNotifications,
  markUserNotificationRead,
  markUserNotificationsSeen,
} from "@/lib/data/repositories/notifications.server"

export async function GET(request: Request) {
  try {
    const actor = await requireNotificationUser(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") ?? 50)
    const result = await getUserNotifications(actor.authId, limit)
    return NextResponse.json(result)
  } catch (error) {
    const response = notificationAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireNotificationUser(request)
    const body = await request.json() as { id?: unknown; all?: unknown; seen?: unknown }

    if (body.seen === true) {
      await markUserNotificationsSeen(actor.authId)
    } else if (body.all === true) {
      await markUserNotificationRead(actor.authId)
    } else {
      const id = Number(body.id)
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid notification." }, { status: 400 })
      }
      await markUserNotificationRead(actor.authId, id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const response = notificationAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
