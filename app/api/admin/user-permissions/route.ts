export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { NavFolders } from "@/lib/Defaults/DefaultValues"
import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import {
  USER_TYPE,
  adminAccessError,
  canManageUser,
  requireAdminActor,
  type ManagedUserProfile,
} from "@/lib/auth/adminAccess"

const ACTIONS = new Set(["list", "view", "insert", "edit", "void", "approval"])

function permissionDefinition(groupName: string, title: string) {
  const slashIndex = title.lastIndexOf("/")
  const action = slashIndex >= 0 ? title.slice(slashIndex + 1) : "list"
  const moduleTitle = slashIndex >= 0 ? title.slice(0, slashIndex) : title
  if (!ACTIONS.has(action)) return null

  for (const folder of NavFolders) {
    for (const group of folder.items ?? []) {
      const child = group.children.find(item => group.group === groupName && item.title === moduleTitle)
      if (!child) continue
      if (action !== "list" && !child[action as keyof typeof child]) return null
      return { folder, child, action }
    }
  }

  return null
}

async function getTarget(authId: string) {
  const { data, error } = await admin_db
    .from("users")
    .select("id, auth_id, email, firstname, lastname, fms_type, user_type, issuper")
    .eq("auth_id", authId)
    .single()

  if (error || !data) return null
  return { ...data, user_type: Number(data.user_type ?? USER_TYPE.USER) } as ManagedUserProfile
}

function canGrantForTarget(actor: ManagedUserProfile, target: ManagedUserProfile, fmsTypes?: string[]) {
  if (!canManageUser(actor, target)) return false
  if (actor.user_type === USER_TYPE.SUPER_ADMIN) {
    return !target.fms_type || !fmsTypes?.length || fmsTypes.includes(target.fms_type)
  }
  return Boolean(actor.fms_type) && Boolean(fmsTypes?.includes(actor.fms_type as string))
}

export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor(request)
    const url = new URL(request.url)
    const targetAuthId = url.searchParams.get("userId")

    if (!targetAuthId) {
      let query = admin_db
        .from("users")
        .select("id, auth_id, email, firstname, lastname, fms_type, user_type, issuper")
        .not("auth_id", "is", null)
        .order("firstname", { ascending: true })

      if (actor.user_type === USER_TYPE.ADMIN) {
        query = query.eq("user_type", USER_TYPE.USER).eq("fms_type", actor.fms_type)
      }

      const { data, error } = await query
      if (error) throw error

      return NextResponse.json({
        actor: { user_type: actor.user_type, fms_type: actor.fms_type },
        users: (data ?? []).map(user => ({ ...user, user_type: Number(user.user_type ?? USER_TYPE.USER) })),
      })
    }

    const target = await getTarget(targetAuthId)
    if (!target || !canManageUser(actor, target)) throw new Error("FORBIDDEN")

    const { data, error } = await admin_db
      .from("user_permissions")
      .select("group_name, title, is_visible, ilink, type")
      .eq("user_id", targetAuthId)
      .eq("is_visible", true)

    if (error) throw error
    return NextResponse.json({ target, permissions: data ?? [] })
  } catch (error) {
    const response = adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActor(request)
    const body = await request.json() as {
      userId?: string
      groupName?: string
      title?: string
      checked?: boolean
    }
    const userId = String(body.userId ?? "").trim()
    const groupName = String(body.groupName ?? "").trim()
    const title = String(body.title ?? "").trim()
    if (!userId || !groupName || !title || typeof body.checked !== "boolean") {
      return NextResponse.json({ error: "Invalid permission request." }, { status: 400 })
    }

    const target = await getTarget(userId)
    const definition = permissionDefinition(groupName, title)
    if (!target || !definition || !canGrantForTarget(actor, target, definition.folder.fmsTypes)) {
      throw new Error("FORBIDDEN")
    }

    const actionUrl = definition.action === "list"
      ? definition.child.url
      : `${definition.child.url}/${definition.action}`

    const { error } = await admin_db.from("user_permissions").upsert({
      user_id: userId,
      group_name: groupName,
      title,
      is_visible: body.checked,
      updated_by: actor.auth_id,
      ilink: actionUrl,
      updated_at: new Date().toISOString(),
      type: definition.action,
    }, { onConflict: "user_id,group_name,title" })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    const response = adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
