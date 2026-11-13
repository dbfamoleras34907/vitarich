export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { NavFolders } from "@/lib/Defaults/DefaultValues"
import { USER_TYPE, adminAccessError, requireAdminActor } from "@/lib/auth/adminAccess"
import { parsePermissionTitle } from "@/lib/auth/permissionActions"
import {
  applyPermissionTemplate,
  listPermissionTemplatesWithAssignments,
  previewPermissionTemplate,
  savePermissionTemplate,
  setPermissionTemplateVoided,
  type StoredPermissionTemplateItem,
} from "@/lib/data/repositories/permissionTemplates.server"

function requireSuperAdmin(userType: number) {
  if (userType !== USER_TYPE.SUPER_ADMIN) throw new Error("FORBIDDEN")
}

function validatePermission(groupName: string, title: string): StoredPermissionTemplateItem | null {
  const { moduleTitle, action } = parsePermissionTitle(title)

  for (const folder of NavFolders) {
    for (const group of folder.items ?? []) {
      const child = group.children.find(item => group.group === groupName && item.title === moduleTitle)
      if (!child) continue
      if (action !== "list" && !child[action as keyof typeof child]) return null
      return {
        group_name: groupName,
        title,
        is_visible: true,
        ilink: action === "list" ? child.url : `${child.url}/${action}`,
        type: action,
      }
    }
  }
  return null
}

export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor(request)
    requireSuperAdmin(actor.user_type)
    return NextResponse.json(await listPermissionTemplatesWithAssignments())
  } catch (error) {
    const response = adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActor(request)
    requireSuperAdmin(actor.user_type)
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action ?? "")

    if (action === "save") {
      const templateName = String(body.templateName ?? "").trim()
      const remarks = String(body.remarks ?? "").trim()
      const rawPermissions = Array.isArray(body.permissions) ? body.permissions : []
      const permissions = rawPermissions.map(permission => {
        const item = permission as Record<string, unknown>
        return validatePermission(String(item.groupName ?? "").trim(), String(item.title ?? "").trim())
      })
      if (!templateName || permissions.some(permission => !permission)) {
        return NextResponse.json({ error: "Invalid permission template." }, { status: 400 })
      }
      const uniquePermissions = Array.from(new Map(
        permissions.filter((permission): permission is StoredPermissionTemplateItem => Boolean(permission))
          .map(permission => [`${permission.group_name}\u0000${permission.title}`, permission]),
      ).values())
      const templateId = body.templateId == null ? null : Number(body.templateId)
      const id = await savePermissionTemplate({
        templateId: Number.isFinite(templateId) ? templateId : null,
        templateName,
        remarks,
        permissions: uniquePermissions,
        actorAuthId: actor.auth_id,
      })
      return NextResponse.json({ success: true, templateId: id })
    }

    if (action === "void") {
      const templateId = Number(body.templateId)
      if (!Number.isInteger(templateId) || typeof body.voided !== "boolean") {
        return NextResponse.json({ error: "Invalid permission template request." }, { status: 400 })
      }
      await setPermissionTemplateVoided(templateId, body.voided)
      return NextResponse.json({ success: true })
    }

    const templateId = Number(body.templateId)
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.map(value => String(value).trim()).filter(Boolean)
      : []
    if (!Number.isInteger(templateId) || !userIds.length) {
      return NextResponse.json({ error: "Select a template and at least one active user." }, { status: 400 })
    }

    if (action === "preview") {
      return NextResponse.json(await previewPermissionTemplate(templateId, userIds))
    }
    if (action === "apply") {
      const result = await applyPermissionTemplate({ templateId, userIds, actorAuthId: actor.auth_id })
      return NextResponse.json({ success: true, result })
    }
    return NextResponse.json({ error: "Invalid permission template request." }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("permission_templates_template_name") || message.includes("Template name already exists")) {
      return NextResponse.json({ error: "Template name already exists." }, { status: 409 })
    }
    const response = adminAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
