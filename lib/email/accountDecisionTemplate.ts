function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;")
}

export function buildAccountDecisionEmail(template: string, reason: string, siteUrl: string) {
  if (!["ACCOUNT_ACTIVATED", "ACCOUNT_REJECTED"].includes(template)) throw new Error("Unknown account email template.")
  const activated = template === "ACCOUNT_ACTIVATED"
  const title = activated ? "Your Vita FMS account is activated" : "Your Vita FMS registration was rejected"
  let message = `Your registration was rejected. Reason: ${escapeHtml(reason)}`
  if (activated) {
    const url = new URL("/login", siteUrl)
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid application URL.")
    message = `Your account has been activated. Log in using your registered email and password, then complete your personal information to continue.<br><br><a href="${escapeHtml(url.href)}">Login to Vita FMS</a>`
  }
  return { subject: title, html: `<html><body style="font-family:Arial,sans-serif;color:#143d2b"><h1 style="font-size:22px">${title}</h1><p>${message}</p><p>Vita FMS</p></body></html>` }
}
