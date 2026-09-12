
export const runtime = "nodejs";
import { createBrowserClient } from '@supabase/ssr'
import { fetchWithInternetErrorNotice } from '@/lib/network/http'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const db = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithInternetErrorNotice,
  },
})

export async function logout() {
  const { error } = await db.auth.signOut()
  if (error) {
    console.error('Logout failed:', error.message)
  } else {
    console.log('User logged out successfully')
  }
}

