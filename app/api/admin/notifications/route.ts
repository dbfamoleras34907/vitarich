export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireNotificationRuleActor, notificationAccessError } from "@/lib/auth/notificationAccess"
import {
  getActiveNotificationUserGroups,
  getNotificationRuleById,
  getNotificationRules,
  saveNotificationRule,
  voidNotificationRule,
} from "@/lib/data/repositories/notifications.server"
import { getNotificationEvent, getNotificationModule } from "@/lib/notifications/catalog"
import { unsupportedNotificationTemplateTokens } from "@/lib/notifications/templatePlaceholders"
import { NOTIFICATION_PRIORITIES, USER_TYPES, type NotificationPriority, type NotificationRuleInput } from "@/lib/notifications/types"

function uniqueNumbers(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(Number).filter(Number.isInteger)))
}

function text(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
}

function intersection<T extends string>(left: readonly T[], right: readonly T[]) {
  return left.filter(value => right.includes(value))
}

function isSubset<T extends string>(values: readonly T[], allowed: readonly T[]) {
  return values.every(value => allowed.includes(value))
}

export async function GET(request: Request) {
  try {
    const actor = await requireNotificationRuleActor(request, "view")
    const [storedRules, userGroups] = await Promise.all([
      getNotificationRules(actor),
      getActiveNotificationUserGroups(),
    ])
    const rules = storedRules.filter(rule => {
      const moduleDefinition = getNotificationModule(rule.module_key)
      return Boolean(
        moduleDefinition
        && moduleDefinition.ruleActivationReady !== false
        && getNotificationEvent(rule.module_key, rule.event_key),
      )
    })

    return NextResponse.json({ actor, rules, userGroups })
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

    if (!name || !moduleDefinition || moduleDefinition.ruleActivationReady === false || !eventDefinition || (id != null && !Number.isInteger(id))) {
      return NextResponse.json({ error: "Invalid notification template." }, { status: 400 })
    }

    let sourceFmsTypes = moduleDefinition.fmsTypes
    const recipientFmsTypes = moduleDefinition.defaultRecipientFmsTypes ?? []
    let userTypes: number[] = []
    const userGroupIds = uniqueNumbers(body.user_group_ids).filter(groupId => groupId > 0)

    const activeGroups = await getActiveNotificationUserGroups()
    const activeGroupIds = new Set(activeGroups.map(group => group.id))
    if (userGroupIds.some(groupId => !activeGroupIds.has(groupId))) {
      return NextResponse.json({ error: "One or more selected user groups are invalid." }, { status: 400 })
    }

    if (actor.userType === USER_TYPES.ADMIN) {
      sourceFmsTypes = intersection(moduleDefinition.fmsTypes, actor.fmsTypes)
      if (sourceFmsTypes.length === 0) throw new Error("FORBIDDEN")
      userTypes = [USER_TYPES.USER]
    }

    if (id) {
      const existing = await getNotificationRuleById(id)
      if (!existing) return NextResponse.json({ error: "Notification template not found." }, { status: 404 })
      if (actor.userType === 2 && !isSubset(existing.source_fms_types, actor.fmsTypes)) {
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
      email_enabled: false,
      exclude_actor: body.exclude_actor !== false,
      require_view_permission: true,
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
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid notification template." }, { status: 400 })

    const existing = await getNotificationRuleById(id)
    if (!existing) return NextResponse.json({ success: true })
    if (actor.userType === 2 && !isSubset(existing.source_fms_types, actor.fmsTypes)) {
      throw new Error("FORBIDDEN")
    }

    await voidNotificationRule(id, actor.authId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const response = notificationAccessError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}
