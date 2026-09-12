
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAccountAccessByAuthId, RegistrationError } from '@/lib/data/repositories/registration.server'

// Authenticate route and API requests before rendering or business access.
export async function proxy(req: NextRequest) {

  let res = NextResponse.next({
    request: { headers: req.headers },
  })

  const pathname = req.nextUrl.pathname

  // Only these blank request templates can be shared without an account.
  if (['/templates/farm-master-addition.xlsx', '/templates/item-master-addition.xlsx'].includes(pathname)) {
    return res
  }

  if (pathname === '/api/auth/register') return res
  const isApi = pathname.startsWith('/api/')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value
        },
        set(name, value, options) {
          req.cookies.set({ name, value, ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          req.cookies.set({ name, value: '', ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const publicRoutes = ['/login', '/signup', '/about']
  const isPublicRoute = publicRoutes.includes(pathname)
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, req.url))
    for (const cookie of res.cookies.getAll()) response.cookies.set(cookie)
    return response
  }
  try {
    const authorization = req.headers.get('authorization') ?? ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      if (isPublicRoute) return res
      return isApi ? NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) : redirect('/login')
    }
    if (pathname === '/logout') return res
    const access = await getAccountAccessByAuthId(user.id)
    if (access.approvalStatus !== 'activated') {
      if (!isApi) {
        await supabase.auth.signOut()
        return redirect('/login')
      }
      return NextResponse.json({ error: 'Your account is not activated.' }, { status: 403 })
    }
    if (pathname === '/api/auth/registration-profile') return res
    if (access.registrationReady !== false && !access.profileComplete) {
      if (pathname === '/signup_update') return res
      return isApi
        ? NextResponse.json({ error: 'Complete your personal information before continuing.', code: 'PROFILE_INCOMPLETE' }, { status: 403 })
        : redirect('/signup_update')
    }
    if (['/login', '/signup', '/signup_update'].includes(pathname)) return redirect('/init')
  } catch (error) {
    if (!isApi) {
      if (isPublicRoute) return res
      return redirect('/login?accountError=unavailable')
    }
    return NextResponse.json({ error: error instanceof RegistrationError ? error.message : 'Unable to check account access. Please try again.' }, { status: 503 })
  }

  return res
}
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones provided below:
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
