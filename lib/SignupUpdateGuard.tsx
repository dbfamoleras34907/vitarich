"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useGlobalContext } from "./context/GlobalContext"

export default function RouteGuard() {

  const pathname = usePathname()
  const router = useRouter()
  const { getValue, setValue } = useGlobalContext()

  useEffect(() => {

    const lastPage = getValue("last_page")

    // if leaving signup_update
    if (
      lastPage === "/signup_update" &&
      pathname !== "/signup_update"
    ) {
      setValue("last_page", "") // reset so it doesn't loop
      router.replace("/logout")
      return
    }

    // only store if currently inside signup_update
    if (pathname === "/signup_update") {
      setValue("last_page", "/signup_update")
    }

  }, [pathname])

  return null
}