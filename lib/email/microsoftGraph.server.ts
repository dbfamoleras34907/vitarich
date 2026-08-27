import "server-only"

import { getEmailSenderAddress } from "./config.server"

type CachedToken = {
  accessToken: string
  expiresAt: number
}

type MicrosoftGraphEmail = {
  to: string
  cc?: string
  subject: string
  html: string
  messageId?: string
}

let cachedToken: CachedToken | null = null
let pendingToken: Promise<string> | null = null

function requiredEnvironment(name: string) {
  const value = String(process.env[name] ?? "").trim()
  if (!value) throw new Error(`Microsoft Graph email is not configured: ${name} is missing.`)
  return value
}

async function responseError(response: Response, operation: string) {
  const responseText = await response.text()
  let code = ""
  let description = responseText

  try {
    const body = JSON.parse(responseText) as {
      error?: string | { code?: string; message?: string }
      error_description?: string
    }
    if (typeof body.error === "string") code = body.error
    else if (body.error) {
      code = String(body.error.code ?? "")
      description = String(body.error.message ?? "")
    }
    if (body.error_description) description = body.error_description
  } catch {
    // Keep the plain response body when Microsoft does not return JSON.
  }

  const detail = [code, description].map(value => value.trim()).filter(Boolean).join(": ")
  return new Error(`${operation} failed (${response.status})${detail ? `: ${detail}` : "."}`.slice(0, 2000))
}

async function requestAccessToken() {
  const tenantId = requiredEnvironment("MICROSOFT_GRAPH_TENANT_ID")
  const clientId = requiredEnvironment("MICROSOFT_GRAPH_CLIENT_ID")
  const clientSecret = requiredEnvironment("MICROSOFT_GRAPH_CLIENT_SECRET")
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  )

  if (!response.ok) throw await responseError(response, "Microsoft Graph token request")

  const token = await response.json() as { access_token?: string; expires_in?: number }
  if (!token.access_token) throw new Error("Microsoft Graph token response did not include an access token.")

  const expiresInSeconds = Math.max(300, Number(token.expires_in ?? 3600))
  cachedToken = {
    accessToken: token.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  }
  return cachedToken.accessToken
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken
  if (!pendingToken) pendingToken = requestAccessToken().finally(() => { pendingToken = null })
  return pendingToken
}

function recipients(value: string) {
  return value
    .split(/[;,]/)
    .map(email => email.trim())
    .filter(Boolean)
    .map(address => ({ emailAddress: { address } }))
}

export async function sendMicrosoftGraphEmail({ to, cc, subject, html, messageId }: MicrosoftGraphEmail) {
  const sender = getEmailSenderAddress()
  if (!sender) throw new Error("Microsoft Graph email is not configured: OUTLOOK_EMAIL is missing.")
  const toRecipients = recipients(to)
  const ccRecipients = recipients(cc ?? '')
  if (toRecipients.length === 0) throw new Error("Email recipient is missing.")

  const token = await getAccessToken()
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients,
          ...(ccRecipients.length > 0 ? { ccRecipients } : {}),
          ...(messageId ? {
            internetMessageHeaders: [{
              name: "x-vita-fms-message-id",
              value: messageId.replace(/[\r\n]/g, "").slice(0, 200),
            }],
          } : {}),
        },
        saveToSentItems: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  )

  if (!response.ok) throw await responseError(response, "Microsoft Graph sendMail")

  return {
    success: true as const,
    messageId: response.headers.get("request-id") ?? messageId ?? undefined,
  }
}
