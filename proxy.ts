
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rename this to 'middleware' so Next.js recognizes it!
export async function proxy(req: NextRequest) {

  let res = NextResponse.next({
    request: { headers: req.headers },
  })

  const pathname = req.nextUrl.pathname

  // ✅ Allow API routes without auth check
  if (pathname.startsWith('/api')) {
    return res
  }

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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const publicRoutes = ['/login', '/signup', '/about']
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && ['/login', '/signup'].includes(pathname)) {
    return NextResponse.redirect(new URL('/home', req.url))
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