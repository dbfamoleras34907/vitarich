import { admin_db } from '@/lib/Supabase/supabaseAdmin'

type NotificationFmsType = 'Broiler' | 'Breeder' | 'Hatchery' | null

type NotificationOutboxInput = {
  moduleKey: string
  eventKey: string
  entityType: string
  entityId: string | number
  documentNo: string | null
  actorAuthId: string
  targetUrl: string | null
  permissionGroup: string
  permissionTitle: string
  title: string
  message: string
  dedupeKey: string
  metadata?: Record<string, unknown>
}

const canonicalFmsType = (value: unknown): NotificationFmsType => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'broiler') return 'Broiler'
  if (normalized === 'breeder') return 'Breeder'
  if (normalized === 'hatchery') return 'Hatchery'
  return null
}

export async function enqueueNotificationEventAfterCommit(input: NotificationOutboxInput) {
  const { data: actor } = await admin_db
    .from('users')
    .select('fms_type')
    .eq('auth_id', input.actorAuthId)
    .maybeSingle()

  const { error } = await admin_db.from('notification_outbox').insert({
    module_key: input.moduleKey,
    event_key: input.eventKey,
    entity_type: input.entityType,
    entity_id: String(input.entityId),
    document_no: input.documentNo,
    fms_type: canonicalFmsType(actor?.fms_type),
    farm_id: null,
    recipient_farm_id: null,
    actor_auth_id: input.actorAuthId,
    target_url: input.targetUrl,
    permission_group: input.permissionGroup,
    permission_title: input.permissionTitle,
    title: input.title,
    message: input.message,
    priority: 'normal',
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupeKey,
    occurred_at: new Date().toISOString(),
  })

  if (error && error.code !== '23505') {
    console.error('Unable to enqueue notification event after commit:', error)
  }
}
