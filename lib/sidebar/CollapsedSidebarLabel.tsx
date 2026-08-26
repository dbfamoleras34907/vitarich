"use client"

import { usePathname } from "next/navigation"
import { useGlobalContext } from "@/lib/context/GlobalContext"
import { useSidebar } from "./SidebarProvider"

type SidebarUserInfo = {
  email?: string | null
  default_farm?: string | number | null
}

type SidebarFarm = {
  id?: string | number | null
  code?: string | null
  name?: string | null
}

const HIDDEN_ROUTES = new Set(["/init", "/login", "/logout", "/signup_update"])

export default function CollapsedSidebarLabel() {
  const pathname = usePathname()
  const { collapsed } = useSidebar()
  const { getValue } = useGlobalContext()

  const rawSession = getValue("UserInfoAuthSession")
  const userInfo = (Array.isArray(rawSession) ? rawSession[0] : undefined) as SidebarUserInfo | undefined
  const email = String(userInfo?.email ?? "").trim()

  const farms = (getValue("getFarmDB") ?? []) as SidebarFarm[]
  const defaultFarmReference = getValue("DefaultFarmId") ?? userInfo?.default_farm
  const defaultFarm = farms.find(farm =>
    String(farm.id ?? "") === String(defaultFarmReference ?? "") ||
    String(farm.code ?? "").trim().toLowerCase() === String(defaultFarmReference ?? "").trim().toLowerCase(),
  )
  const defaultFarmName = String(defaultFarm?.name ?? defaultFarm?.code ?? "Default Farm").trim()

  if (!collapsed || !email || HIDDEN_ROUTES.has(pathname)) return null

  return (
    <div className="hidden h-6 w-full shrink-0 items-center justify-center gap-2 text-xs text-muted-foreground md:flex print:hidden">
      <span className="max-w-[42vw] truncate font-medium text-foreground">{email}</span>
      <span aria-hidden="true">•</span>
      <span className="max-w-[42vw] truncate">Default Farm: {defaultFarmName}</span>
    </div>
  )
}
