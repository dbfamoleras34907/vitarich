import 'server-only'

import nodemailer from 'nodemailer'
import { getEmailSenderAddress } from '@/lib/email/config.server'
import { sendMicrosoftGraphEmail } from '@/lib/email/microsoftGraph.server'

const senderEmail = getEmailSenderAddress()

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: senderEmail,
    pass: process.env.OUTLOOK_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
  },
})

type SendEmailProps = {
  to: string
  cc?: string
  subject: string
  html: string
  fromName?: string
  messageId?: string
}

export async function sendEmail({
  to,
  cc,
  subject,
  html,
  fromName = 'WKS Timesheet',
  messageId,
}: SendEmailProps) {
  try {
    const transport = String(process.env.EMAIL_TRANSPORT ?? 'smtp').trim().toLowerCase()
    if (transport === 'microsoft-graph' || transport === 'graph') {
      return await sendMicrosoftGraphEmail({ to, cc, subject, html, messageId })
    }

    const info = await transporter.sendMail({
      from: `"${fromName}" <${senderEmail}>`,
      to,
      ...(cc ? { cc } : {}),
      subject,
      html,
      ...(messageId ? { messageId } : {}),
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    console.error('Email Error:', error)

    return {
      success: false,
      error,
    }
  }
}
