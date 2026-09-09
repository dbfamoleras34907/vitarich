export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireNotificationRuleActor, notificationAccessError } from "@/lib/auth/notificationAccess"
import {
  getActiveNotificationUserGroups,
  getNotificationRuleAffectedUsers,
  getNotificationRuleById,
  getNotificationRules,
  getNotificationOutboxHealth,
  saveNotificationRule,
  voidNotificationRule,
} from "@/lib/data/repositories/notifications.server"
import { getNotificationEvent, getNotificationModule } from "@/lib/notifications/catalog"
import { unsupportedNotificationTemplateTokens } from "@/lib/notifications/templatePlaceholders"
import {
  FMS_TYPES,
  NOTIFICATION_PRIORITIES,
  type FmsType,
  type NotificationPriority,
  type NotificationRuleInput,
} from "@/lib/notifications/types"

function uniqueNumbers(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(Number).filter(Number.isInteger)))
}

function uniqueFmsTypes(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(String)))
    .filter((item): item is FmsType => FMS_TYPES.includes(item as FmsType))
}

function text(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
}

export async function GET(request: Request) {
  try {
    const actor = await requireNotificationRuleActor(request, "view")
    const ruleIdValue = new URL(request.url).searchParams.get("ruleId")

    if (ruleIdValue != null) {
      const ruleId = Number(ruleIdValue)
      if (!Number.isInteger(ruleId) || ruleId <= 0) {
        return NextResponse.json({ error: "Invalid notification rule." }, { status: 400 })
      }

      const rule = await getNotificationRuleById(ruleId)
      if (!rule) return NextResponse.json({ error: "Notification rule not found." }, { status: 404 })
      if (actor.userType === 2 && (!actor.fmsType || !rule.source_fms_types.includes(actor.fmsType))) {
        throw new Error("FORBIDDEN")
      }

      const moduleDefinition = getNotificationModule(rule.module_key)
      const eventDefinition = getNotificationEvent(rule.module_key, rule.event_key)
      if (!moduleDefinition || !eventDefinition) {
        return NextResponse.json({ error: "Notification rule uses an unsupported module or event." }, { status: 409 })
      }

      const affectedUsers = await getNotificationRuleAffectedUsers(rule, {
        permissionGroup: moduleDefinition.permissionGroup,
        permissionTitle: moduleDefinition.permissionTitle,
        farmRouting: eventDefinition.farmRouting,
      })
      return NextResponse.json(affectedUsers)
    }

    const [rules, userGroups, outboxHealth] = await Promise.all([
      getNotificationRules(actor),
      getActiveNotificationUserGroups(),
      getNotificationOutboxHealth(),
    ])

    return NextResponse.json({ actor, rules, userGroups, outboxHealth })
  } catch (error) {
    const response = notificationAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireNotificationRuleActor(request, "edit")
    const body = await request.json() as Record<string, unknown>
    const id = body.id == null ? undefined : Number(body.id)
    const name = text(body.name, 120)
    const moduleKey = text(body.module_key, 100)
    const eventKey = text(body.event_key, 140)
    const moduleDefinition = getNotificationModule(moduleKey)
    const eventDefinition = getNotificationEvent(moduleKey, eventKey)

    if (!name || !moduleDefinition || !eventDefinition || (id != null && !Number.isInteger(id))) {
      return NextResponse.json({ error: "Invalid notification rule." }, { status: 400 })
    }

    let sourceFmsTypes = uniqueFmsTypes(body.source_fms_types)
      .filter(fmsType => moduleDefinition.fmsTypes.includes(fmsType))
    const recipientFmsTypes = uniqueFmsTypes(body.recipient_fms_types)
    let userTypes = uniqueNumbers(body.user_types).filter(userType => [1, 2, 3].includes(userType))
    const userGroupIds = uniqueNumbers(body.user_group_ids).filter(groupId => groupId > 0)

    const activeGroups = await getActiveNotificationUserGroups()
    const activeGroupIds = new Set(activeGroups.map(group => group.id))
    if (userGroupIds.some(groupId => !activeGroupIds.has(groupId))) {
      return NextResponse.json({ error: "One or more selected user groups are invalid." }, { status: 400 })
    }

    if (actor.userType === 2) {
      if (!actor.fmsType || !moduleDefinition.fmsTypes.includes(actor.fmsType)) throw new Error("FORBIDDEN")
      sourceFmsTypes = [actor.fmsType]
      userTypes = [3]
    }

    if (id) {
      const existing = await getNotificationRuleById(id)
      if (!existing) return NextResponse.json({ error: "Notification rule not found." }, { status: 404 })
      if (actor.userType === 2 && (!actor.fmsType || !existing.source_fms_types.includes(actor.fmsType))) {
        throw new Error("FORBIDDEN")
      }
    }

    const requestedPriority = text(body.priority, 20) as NotificationPriority
    const titleTemplate = text(body.title_template, 180)
    const messageTemplate = text(body.message_template, 1000)
    const unsupportedTokens = Array.from(new Set([
      ...unsupportedNotificationTemplateTokens(titleTemplate),
      ...unsupportedNotificationTemplateTokens(messageTemplate),
    ]))
    if (unsupportedTokens.length > 0) {
      return NextResponse.json(
        { error: `Unsupported template placeholder${unsupportedTokens.length === 1 ? "" : "s"}: ${unsupportedTokens.join(", ")}` },
        { status: 400 },
      )
    }

    const input: NotificationRuleInput = {
      ...(id ? { id } : {}),
      name,
      module_key: moduleKey,
      event_key: eventKey,
      source_fms_types: sourceFmsTypes,
      recipient_fms_types: recipientFmsTypes,
      user_types: userTypes,
      user_group_ids: userGroupIds,
      title_template: titleTemplate || null,
      message_template: messageTemplate || null,
      priority: NOTIFICATION_PRIORITIES.includes(requestedPriority) ? requestedPriority : "normal",
      email_enabled: body.email_enabled === true,
      exclude_actor: body.exclude_actor !== false,
      require_view_permission: body.require_view_permission !== false,
      is_active: body.is_active !== false,
    }

    const rule = await saveNotificationRule(input, actor.authId)
    return NextResponse.json({ rule })
  } catch (error) {
    const response = notificationAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireNotificationRuleActor(request, "edit")
    const body = await request.json() as { id?: unknown }
    const id = Number(body.id)
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid notification rule." }, { status: 400 })

    const existing = await getNotificationRuleById(id)
    if (!existing) return NextResponse.json({ success: true })
    if (actor.userType === 2 && (!actor.fmsType || !existing.source_fms_types.includes(actor.fmsType))) {
      throw new Error("FORBIDDEN")
    }

    await voidNotificationRule(id, actor.authId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const response = notificationAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
