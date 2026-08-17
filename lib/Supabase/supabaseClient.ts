
export const runtime = "nodejs";
import { createBrowserClient } from '@supabase/ssr'
import { isInternetError, notifyInternetError } from '@/lib/networkError'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const fetchWithInternetErrorNotice: typeof fetch = async (...args) => {
  try {
    return await fetch(...args)
  } catch (error) {
    if (isInternetError(error)) {
      notifyInternetError(error)
      // Keep the original rejection so Supabase callers can handle the failed
      // request without turning it into a new application error.
      throw error
    }
    throw error
  }
}

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

