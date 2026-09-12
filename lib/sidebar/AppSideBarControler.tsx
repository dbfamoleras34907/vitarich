'use client'
import { AppSidebar } from '@/lib/sidebar/AppSidebar'
import { User } from '@supabase/supabase-js'
import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { db } from '../Supabase/supabaseClient'

export default function AppSideBarControler() {
  const [user, setUser] = useState<User | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await db.auth.getSession()
      setUser(session?.user ?? null)
    }
    getUser()
  }, [pathname])

  return (
    <div>
      {user && !["/signup_update", "/login", "/signup", "/logout"].includes(pathname) && <AppSidebar />}
      {/* <AppSidebar /> */}
    </div>
  )
}
