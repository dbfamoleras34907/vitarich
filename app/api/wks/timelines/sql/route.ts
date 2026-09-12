import { NextResponse } from 'next/server'
import { getWorkspaceTimelineSql } from '@/lib/data/repositories/workspaceTimelineSql.server'

export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const [scheme, token] = authorization.split(' ')
  if (scheme.toLowerCase() !== 'bearer' || !token) {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401, headers })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers })
  }

  const password = typeof body === 'object' && body !== null && 'password' in body
    ? body.password
    : undefined

  try {
    const result = await getWorkspaceTimelineSql(token, password)
    return NextResponse.json(result, { headers })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const status = code === 'UNAUTHENTICATED' ? 401 : code === 'INVALID_PASSWORD' ? 403 : 500
    const message = status === 401 ? 'Please sign in again.'
      : status === 403 ? 'Incorrect password.'
        : 'Unable to load the timeline SQL. Please try again.'
    return NextResponse.json({ error: message }, { status, headers })
  }
}
