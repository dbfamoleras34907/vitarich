import { sendEmail } from '@/email'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      to,
      subject,
      html,
    } = body

    if (!to || !subject || !html) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields',
        },
        { status: 400 }
      )
    }

    const result = await sendEmail({
      to,
      subject,
      html,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to send email',
          error: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        success: false,
        message: 'Something went wrong',
      },
      { status: 500 }
    )
  }
}