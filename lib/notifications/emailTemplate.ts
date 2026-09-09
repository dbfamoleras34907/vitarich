import { getNotificationEvent, getNotificationModule } from "./catalog"
import type { NotificationEmailDelivery } from "./types"

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return value == null ? "" : String(value).trim()
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = Number(metadata[key])
  return Number.isFinite(value) ? value : null
}

function formatQuantity(value: number | null) {
  if (value == null) return ""
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value)
}

function formatOccurredAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date)
}

function detailRow(label: string, value: string) {
  if (!value) return ""
  return `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;width:42%;border-bottom:1px solid #e2e8f0;">${escapeHtml(label)}</td><td style="padding:8px 12px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${escapeHtml(value)}</td></tr>`
}

export function buildNotificationEmail(delivery: NotificationEmailDelivery) {
  const moduleDefinition = getNotificationModule(delivery.module_key)
  const eventDefinition = getNotificationEvent(delivery.module_key, delivery.event_key)
  const metadata = delivery.metadata ?? {}
  const fmsType = delivery.recipient_fms_type ?? "FMS"
  const moduleLabel = moduleDefinition?.label ?? delivery.module_key
  const eventLabel = eventDefinition?.label ?? delivery.event_key
  const farmCode = metadataText(metadata, "destinationFarmCode") || metadataText(metadata, "farmCode")
  const farmName = metadataText(metadata, "destinationFarmName") || metadataText(metadata, "farmName")
  const farm = [farmCode, farmName].filter(Boolean).join(" - ")
  const totalQuantity = metadataNumber(metadata, "totalQuantity")
  const actualQuantity = metadataNumber(metadata, "actualQuantity")
  const doaQuantity = metadataNumber(metadata, "doaQuantity")
  const rejectQuantity = metadataNumber(metadata, "rejectQuantity")
  const lineCount = metadataNumber(metadata, "lineCount")
  const subject = `[Vita FMS · ${fmsType}] ${delivery.title}${delivery.document_no ? ` - ${delivery.document_no}` : ""}`
  const details = [
    detailRow("Notification type", `${moduleLabel} · ${eventLabel}`),
    detailRow("Document number", delivery.document_no ?? ""),
    detailRow("Farm", farm),
    detailRow("Total quantity", formatQuantity(totalQuantity)),
    detailRow("Actual received", formatQuantity(actualQuantity)),
    detailRow("DOA quantity", formatQuantity(doaQuantity)),
    detailRow("Reject quantity", formatQuantity(rejectQuantity)),
    detailRow("Document lines", lineCount == null ? "" : formatQuantity(lineCount)),
    detailRow("Posted by", delivery.initiator_name ?? "a user"),
    detailRow("Posted at", formatOccurredAt(delivery.occurred_at)),
  ].join("")

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#14532d;padding:22px 24px;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:.8;">Email notification</div>
            <div style="font-size:22px;font-weight:700;margin-top:5px;">Vita FMS · ${escapeHtml(fmsType)}</div>
            <div style="font-size:13px;margin-top:7px;opacity:.88;">${escapeHtml(moduleLabel)} · ${escapeHtml(eventLabel)}</div>
          </td></tr>
          <tr><td style="padding:24px;">
            <div style="font-size:14px;color:#475569;">Hello ${escapeHtml(delivery.recipient_name || "FMS user")},</div>
            <h1 style="font-size:20px;line-height:1.35;margin:14px 0 8px;color:#0f172a;">${escapeHtml(delivery.title)}</h1>
            <p style="font-size:14px;line-height:1.65;margin:0 0 20px;color:#334155;">${escapeHtml(delivery.message)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">
              ${details}
            </table>
            <p style="font-size:12px;line-height:1.5;color:#64748b;margin:20px 0 0;">This is an automated Vita FMS notification. No document link is included.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  }
}
