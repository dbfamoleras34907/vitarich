export const NOTIFICATION_TEMPLATE_PLACEHOLDERS = [
  {
    token: "{document_no}",
    key: "document_no",
    label: "Document number",
    description: "The committed document number, such as DR-082026-0002.",
  },
  {
    token: "{initiator_name}",
    key: "initiator_name",
    label: "Initiator name",
    description: "The user who successfully completed the Post, Edit, or Void action.",
  },
] as const

const ACCEPTED_TEMPLATE_TOKENS = new Set<string>([
  ...NOTIFICATION_TEMPLATE_PLACEHOLDERS.map(item => item.token),
  "{actor_name}",
])

export function unsupportedNotificationTemplateTokens(value: string) {
  return Array.from(new Set(value.match(/\{[^{}]*\}/g) ?? []))
    .filter(token => !ACCEPTED_TEMPLATE_TOKENS.has(token))
}
