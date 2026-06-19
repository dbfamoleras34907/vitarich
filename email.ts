import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.OUTLOOK_EMAIL,
    pass: process.env.OUTLOOK_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
  },
})

type SendEmailProps = {
  to: string
  subject: string
  html: string
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailProps) {
  try {
    const info = await transporter.sendMail({
      from: `"WKS Timesheet" <${process.env.OUTLOOK_EMAIL}>`,
      to,
      subject,
      html,
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