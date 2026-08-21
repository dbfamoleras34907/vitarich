export const FMS_TYPES = ["Broiler", "Breeder", "Hatchery"] as const
export type FmsType = typeof FMS_TYPES[number]

export const USER_TYPES = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  USER: 3,
} as const

export const NOTIFICATION_PRIORITIES = ["low", "normal", "high", "critical"] as const
export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[number]

export const NOTIFICATION_FARM_ROUTING = ["document", "origin", "destination", "origin_and_destination", "none"] as const
export type NotificationFarmRouting = typeof NOTIFICATION_FARM_ROUTING[number]

export type NotificationEventDefinition = {
  key: string
  label: string
  description: string
  action: "posted" | "edited" | "voided" | "approved" | "rejected"
  farmRouting: NotificationFarmRouting
}

export type NotificationModuleDefinition = {
  key: string
  label: string
  description: string
  fmsTypes: FmsType[]
  defaultRecipientFmsTypes?: FmsType[]
  permissionGroup: string
  permissionTitle: string
  baseUrl: string
  events: NotificationEventDefinition[]
}

export type NotificationCatalog = NotificationModuleDefinition[]

export type NotificationRule = {
  id: number
  name: string
  module_key: string
  event_key: string
  source_fms_types: FmsType[]
  recipient_fms_types: FmsType[]
  user_types: number[]
  user_group_ids: number[]
  title_template: string | null
  message_template: string | null
  priority: NotificationPriority
  email_enabled: boolean
  exclude_actor: boolean
  require_view_permission: boolean
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export type NotificationRuleInput = Omit<
  NotificationRule,
  "id" | "created_at" | "updated_at"
> & { id?: number }

export type NotificationUserGroup = {
  id: number
  code: string
  group_name: string
}

export type NotificationAffectedFarm = {
  id: number | null
  code: string
  name: string | null
}

export type NotificationAffectedUser = {
  id: number
  name: string
  email: string | null
  fmsType: FmsType | null
  userType: number
  userGroupName: string | null
  farms: NotificationAffectedFarm[]
  farmBypass: boolean
  emailEligible: boolean
}

export type NotificationRuleAffectedUsers = {
  users: NotificationAffectedUser[]
  farmRouting: NotificationFarmRouting
  farmDependent: boolean
  excludeInitiator: boolean
}

export type NotificationInboxItem = {
  id: number
  event_id: string
  module_key: string
  event_key: string
  title: string
  message: string
  priority: NotificationPriority
  target_url: string | null
  occurred_at: string
  delivered_at: string
  seen_at: string | null
  read_at: string | null
}

export type NotificationOutboxFailure = {
  id: string
  event_key: string
  document_no: string | null
  status: string
  attempt_count: number
  last_error: string | null
  next_attempt_at: string
  occurred_at: string
}

export type NotificationEmailFailure = {
  id: number
  event_key: string
  document_no: string | null
  recipient_email: string | null
  status: string
  attempt_count: number
  last_error: string | null
  next_attempt_at: string
  occurred_at: string
}

export type NotificationOutboxHealth = {
  pendingCount: number
  failedCount: number
  emailPendingCount: number
  emailFailedCount: number
  recentFailures: NotificationOutboxFailure[]
  recentEmailFailures: NotificationEmailFailure[]
}

export type NotificationEmailDelivery = {
  id: number
  event_id: string
  rule_id: number | null
  user_notification_id: number | null
  recipient_user_id: number
  recipient_auth_id: string
  recipient_email: string | null
  recipient_name: string | null
  recipient_fms_type: FmsType | null
  initiator_name: string | null
  module_key: string
  event_key: string
  document_no: string | null
  title: string
  message: string
  priority: NotificationPriority
  metadata: Record<string, unknown>
  occurred_at: string
  status: "pending" | "processing" | "sent" | "failed" | "skipped"
  attempt_count: number
}

export type NotificationRuleAccess = {
  authId: string
  userType: number
  fmsType: FmsType | null
}
