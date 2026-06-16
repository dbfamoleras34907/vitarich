export const runtime = "nodejs";

import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { data, error } = await admin_db
      .from('week_locks')
      .select('*')
      .order('year', { ascending: false })
      .order('week', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data || [], { status: 200 })
  } catch (err: any) {
    console.error('GET /api/admin/lock error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { week, year } = body
    if (!week || !year) {
      return NextResponse.json({ error: 'week and year are required' }, { status: 400 })
    }

    // if existing week/year found, return message
    const { data: exists, error: selErr } = await admin_db
      .from('week_locks')
      .select('*')
      .eq('week', week)
      .eq('year', year)
      .limit(1)

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 400 })
    }

    if (exists && exists.length > 0) {
      return NextResponse.json({ error: 'Week already exists' }, { status: 409 })
    }

    const payload = {
      week,
      year,
      locked_by: 'system',
      locked_at: new Date().toISOString(),
      status: 'Locked',
    }

    const { data, error } = await admin_db.from('week_locks').insert([payload])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data?.[0] ?? payload, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/admin/lock error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, action } = body
    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
    }

    const updates: any = {}
    if (action === 'unlock') {
      updates.status = 'Open'
      updates.locked_by = null
      updates.locked_at = null
    } else if (action === 'lock') {
      updates.status = 'Locked'
      updates.locked_by = 'system'
      updates.locked_at = new Date().toISOString()
    } else {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    const { data, error } = await admin_db.from('week_locks').update(updates).eq('id', id).select()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data?.[0] ?? null, { status: 200 })
  } catch (err: any) {
    console.error('PATCH /api/admin/lock error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
