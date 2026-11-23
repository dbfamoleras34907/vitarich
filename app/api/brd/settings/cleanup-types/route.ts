export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { adminAccessError, requireModuleActor } from '@/lib/auth/adminAccess'
import {
  createCleanupTypeForAuthorizedUser,
  listCleanupTypesForSettings,
  renameCleanupTypeForAuthorizedUser,
  setCleanupTypeVoidForAuthorizedUser,
} from '@/lib/data/repositories/brCleanupTypes.server'

const BASE_LINK = '/brd/settings/general'

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'CLEANUP_TYPE_NAME_REQUIRED') return { status: 400, message: 'Cleanup Type Name is required.' }
  if (message === 'CLEANUP_TYPE_NAME_TOO_LONG') return { status: 400, message: 'Cleanup Type Name must be 80 characters or fewer.' }
  if (message === 'CLEANUP_TYPE_NAME_EXISTS') return { status: 409, message: 'A Cleanup Type with this name already exists.' }
  if (message === 'CLEANUP_TYPE_NOT_FOUND') return { status: 404, message: 'The Cleanup Type was not found.' }
  return adminAccessError(error)
}

function responseError(error: unknown) {
  const result = routeError(error)
  return NextResponse.json({ error: result.message }, { status: result.status })
}

export async function GET(request: Request) {
  try {
    await requireModuleActor(request, BASE_LINK)
    return NextResponse.json({ rows: await listCleanupTypesForSettings() })
  } catch (error) {
    return responseError(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireModuleActor(request, `${BASE_LINK}/insert`)
    const body = await request.json() as { name?: unknown; actionId?: unknown }
    const actionId = String(body.actionId ?? '').trim()
    if (!actionId) return NextResponse.json({ error: 'Invalid Cleanup Type request.' }, { status: 400 })

    const data = await createCleanupTypeForAuthorizedUser(actor.auth_id, body.name, actionId)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return responseError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      action?: unknown
      id?: unknown
      name?: unknown
      isVoid?: unknown
      actionId?: unknown
    }
    const action = String(body.action ?? '')
    const id = Number(body.id)
    const actionId = String(body.actionId ?? '').trim()
    if (!Number.isInteger(id) || id <= 0 || !actionId) {
      return NextResponse.json({ error: 'Invalid Cleanup Type request.' }, { status: 400 })
    }

    if (action === 'rename') {
      const actor = await requireModuleActor(request, `${BASE_LINK}/edit`)
      const data = await renameCleanupTypeForAuthorizedUser(actor.auth_id, id, body.name, actionId)
      return NextResponse.json({ data })
    }

    if (action === 'set_void' && typeof body.isVoid === 'boolean') {
      const actor = await requireModuleActor(request, `${BASE_LINK}/void`)
      const data = await setCleanupTypeVoidForAuthorizedUser(actor.auth_id, id, body.isVoid, actionId)
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Invalid Cleanup Type action.' }, { status: 400 })
  } catch (error) {
    return responseError(error)
  }
}
