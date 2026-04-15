'use client'

import { db } from '@/lib/Supabase/supabaseClient'
import { useRouter } from 'next/navigation'

export async function refreshSessionx(router: ReturnType<typeof useRouter>) {
  const now = Date.now()
  const fifteenMinutes = 15 * 60 * 1000

  const { data: { session }, error } = await db.auth.getSession()

  if (error || !session || !session.expires_at) {
    router.push('/timeout')
    return null
  }

  const expiresAt = session.expires_at * 1000
  if (now > expiresAt) {
    router.push('/timeout')
    return null
  }

  const lastRefresh = localStorage.getItem('last_refresh_time')
  // // console.log(lastRefresh)
  // // console.log(fifteenMinutes)
  // // console.log(now - parseInt(lastRefresh || ""))
  const needRefresh = !lastRefresh || now - parseInt(lastRefresh) >= fifteenMinutes

  if (!needRefresh) {
    return session
  }

  const { data, error: refreshError } = await db.auth.refreshSession()
  if (refreshError || !data.session || !data.session.expires_at) {
    router.push('/timeout')
    return null
  }

  localStorage.setItem('last_refresh_time', now.toString())

  return data.session
}