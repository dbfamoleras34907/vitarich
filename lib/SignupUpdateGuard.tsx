"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getRegistrationStatus } from "@/lib/data/repositories/registration"
import { Loader, LoaderCircle } from "lucide-react"

export default function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checkedPath, setCheckedPath] = useState("")
  const [error, setError] = useState("")
  const unrestricted = ["/login", "/signup", "/about", "/logout", "/signup_update"].includes(pathname)
  useEffect(() => {
    if (unrestricted) return
    let cancelled = false
    void getRegistrationStatus().then(status => {
      if (cancelled) return
      if (status.approvalStatus !== "activated") router.replace("/logout")
      else if (status.registrationReady !== false && !status.profileComplete) router.replace("/signup_update")
      else { setError(""); setCheckedPath(pathname) }
    }).catch(error => {
      if (!cancelled) setError(error instanceof Error ? error.message : "Unable to check your account.")
    })
    return () => { cancelled = true }
  }, [pathname, router, unrestricted])
  if (unrestricted || checkedPath === pathname) return children
  return <div className="p-6 text-center text-sm">
    {error || <><div><Loader className="animate-spin w-full items-center" /></div></>}
    
    {error && <p><a href="/logout" className="text-primary underline">Logout</a></p>}</div>
}
