import "server-only"

const ASCII_EMAIL_PATTERN = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export function getEmailSenderAddress() {
  const rawValue = String(process.env.OUTLOOK_EMAIL ?? "")
  return rawValue.match(ASCII_EMAIL_PATTERN)?.[0] ?? rawValue.trim()
}

export function isNotificationEmailExcluded(email: string) {
  const excludedAddresses = String(process.env.NOTIFICATION_EMAIL_EXCLUDED_ADDRESSES ?? "")
    .split(/[;,]/)
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
  return excludedAddresses.includes(email.trim().toLowerCase())
}
