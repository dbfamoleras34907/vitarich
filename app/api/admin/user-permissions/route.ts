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
    .maybeSingle()

  if (error) throw error
  if (!data) return null
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
        .select("id, auth_id, email, firstname, middlename, lastname, created_at, updated_at, isactive, fms_type, user_type, issuper")
        .not("auth_id", "is", null)
        .order("firstname", { ascending: true })

      if (actor.user_type === USER_TYPE.ADMIN) {
        query = query.eq("user_type", USER_TYPE.USER).eq("fms_type", actor.fms_type)
      }

      const { data, error } = await query
      if (error) throw error

      if (url.searchParams.get("view") === "matrix") {
        const userIds = (data ?? []).map(user => user.auth_id).filter(Boolean)
        const permissionResult = userIds.length
          ? await admin_db
            .from("user_permissions")
            .select("user_id, group_name, title")
            .in("user_id", userIds)
            .eq("is_visible", true)
          : { data: [], error: null }

        if (permissionResult.error) throw permissionResult.error
        const permissionsByUser = new Map<string, Array<{ group_name: string; title: string }>>()
        for (const permission of permissionResult.data ?? []) {
          const current = permissionsByUser.get(permission.user_id) ?? []
          current.push({ group_name: permission.group_name, title: permission.title })
          permissionsByUser.set(permission.user_id, current)
        }

        return NextResponse.json({
          users: (data ?? []).map(user => ({
            ...user,
            user_type: Number(user.user_type ?? USER_TYPE.USER),
            permissions: permissionsByUser.get(user.auth_id) ?? [],
          })),
        })
      }

      return NextResponse.json({
        actor: { auth_id: actor.auth_id, user_type: actor.user_type, fms_type: actor.fms_type },
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
      changes?: Array<{ groupName?: string; title?: string; checked?: boolean }>
    }
    const userId = String(body.userId ?? "").trim()
    const changes = Array.isArray(body.changes)
      ? body.changes.map(change => ({
        groupName: String(change.groupName ?? "").trim(),
        title: String(change.title ?? "").trim(),
        checked: change.checked,
      }))
      : []
    if (!userId || !changes.length || changes.some(change => !change.groupName || !change.title || typeof change.checked !== "boolean")) {
      return NextResponse.json({ error: "Invalid permission request." }, { status: 400 })
    }
    const uniqueChanges = Array.from(new Map(
      changes.map(change => [`${change.groupName}\u0000${change.title}`, change]),
    ).values())

    const target = await getTarget(userId)
    if (!target) throw new Error("FORBIDDEN")

    const updatedAt = new Date().toISOString()
    const rows = uniqueChanges.map(change => {
      const definition = permissionDefinition(change.groupName, change.title)
      if (!definition || !canGrantForTarget(actor, target, definition.folder.fmsTypes)) {
        throw new Error("FORBIDDEN")
      }

      return {
        user_id: userId,
        group_name: change.groupName,
        title: change.title,
        is_visible: change.checked,
        updated_by: actor.auth_id,
        ilink: definition.action === "list"
          ? definition.child.url
          : `${definition.child.url}/${definition.action}`,
        updated_at: updatedAt,
        type: definition.action,
      }
    })

    const { error } = await admin_db
      .from("user_permissions")
      .upsert(rows, { onConflict: "user_id,group_name,title" })

    if (error) throw error
    return NextResponse.json({ success: true, updated: rows.length })
  } catch (error) {
    const response = adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
