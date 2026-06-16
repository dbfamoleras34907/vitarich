/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '@/lib/Supabase/supabaseClient'
import { WeekLock } from '@/lib/types'

export async function GetLocks(): Promise<WeekLock[]> {
  const { data, error } = await db.from('week_locks').select('*').order('year', { ascending: false }).order('week', { ascending: false })
  if (error) {
    console.error('Supabase Select Error:', error)
    throw new Error(error.message)
  }
  return data as WeekLock[]
}

export async function insertLock(payload: { week: number; year: number }): Promise<any> {
  const { week, year } = payload
  const { data: exists, error: selErr } = await db.from('week_locks').select('*').eq('week', week).eq('year', year).limit(1)
  if (selErr) {
    console.error('Supabase Select Error:', selErr)
    throw new Error(selErr.message)
  }
  if (exists && exists.length > 0) {
    throw new Error('Week already exists')
  }
  const payloadInsert = {
    week,
    year,
    locked_by: null,
    locked_at: null,
    status: 'Locked',
    created_at: new Date().toISOString(),
  }
  const { data, error } = await db.from('week_locks').insert([payloadInsert]).select()
  if (error) {
    console.error('Supabase Insert Error:', error)
    throw new Error(error.message)
  }
  return data
}

export async function toggleLock(id: number, action: 'lock' | 'unlock') {
  const updates: any = {}
  if (action === 'unlock') {
    updates.status = 'Open'
    updates.locked_by = null
    updates.locked_at = null
  } else {
    updates.status = 'Locked'
    updates.locked_by = null
    updates.locked_at = new Date().toISOString()
  }
  const { data, error } = await db.from('week_locks').update(updates).eq('id', id).select()
  if (error) {
    console.error('Supabase Update Error:', error)
    throw new Error(error.message)
  }
  return data
}
