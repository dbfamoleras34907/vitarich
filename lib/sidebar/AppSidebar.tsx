/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { useSidebar } from "./SidebarProvider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePathname, useRouter } from "next/navigation"
import { useGlobalContext } from "../context/GlobalContext"
import { NavFolders } from "../Defaults/DefaultValues"
import GlobalSearch from "@/components/ui/GlobalSearch"
import { db } from "../Supabase/supabaseClient"
import { Session } from "@supabase/supabase-js"
import UserAccountMenu from "../UserAccountMenu"
import { getModuleIcon } from "./moduleIcons"

const ACTIVE_NAV_ITEM_CLASS =
  "relative bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-primary before:content-['']"
const SIDEBAR_SCROLL_CLASS =
  "[scrollbar-color:#d6d3d1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300/80 hover:[&::-webkit-scrollbar-thumb]:bg-stone-400/90"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()



  const { collapsed, toggle } = useSidebar()

  const { getValue, setValue } = useGlobalContext()
  const userPermissions = getValue("UserPermission")

  const [session, setSession] = useState<Session | null>()
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const filteredNavFolders = useMemo(
    () => filterNavFolders(NavFolders, userPermissions || []),
    [userPermissions],
  )

  // ===============================
  // INIT
  // ===============================

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await db.auth.getSession()
      setSession(session)
    }
    getUser()
  }, [])

  // ===============================
  // ACTIONS
  // ===============================

  const goTo = (url: string) => {
    setValue("loading_s", true)
    router.push(url)
  }
  // exclude appSideBar from this pages
  if (pathname === "/signup_update" || pathname === "/init" || pathname === "/logout") return null;
  // ===============================
  // MOBILE VIEW
  // ===============================

  if (isMobile) {
    return (
      <>
        {!mobileOpen && (
          <Button
            variant="ghost"
            onClick={() => setMobileOpen(true)}
            className="fixed z-50 left-3 top-3 bg-card/95 p-2 shadow-[var(--starbucks-nav-shadow)]"
          >
            <Menu className="size-5" />
          </Button>
        )}

        {mobileOpen && (
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />

            <aside className="relative h-full w-72 bg-sidebar p-3 text-sidebar-foreground shadow-lg">

              {/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
              <div className="mb-3 flex items-center gap-3 rounded-md bg-card px-3 py-3 shadow-[var(--starbucks-card-shadow)]">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  V
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">Vita FMS</div>
                  <div className="truncate text-xs text-muted-foreground">Operations</div>
                </div>
              </div>
              <GlobalSearch collapsed={false} />

              <div className={`mt-4 max-h-[calc(100vh-15rem)] space-y-5 overflow-y-auto rounded-md bg-card/70 p-2 pb-6 shadow-[var(--starbucks-card-shadow)] ${SIDEBAR_SCROLL_CLASS}`}>

                {filteredNavFolders.map(folder => (
                  <div key={folder.id} className="space-y-1">
                    <div className="px-2 text-xs font-medium text-sidebar-foreground/45">
                      {folder.title}
                    </div>

                    {folder.items?.flatMap((group: any) =>
                      group.children
                        .filter((child: any) => child.url && child.url !== "#")
                        .map((child: any) => {
                          const Icon = getModuleIcon(child.title, child.type)

                          return (
                            <Button
                              key={`${folder.id}-${group.group}-${child.title}`}
                              variant="ghost"
                              className={`h-9 w-full justify-start rounded-md px-2 text-sm font-normal text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${pathname.startsWith(child.url)
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : ""
                                }`}
                              onClick={() => goTo(child.url)}
                            >
                              <Icon className="size-4 shrink-0 text-sidebar-foreground/70" />
                              <span className="truncate">{child.title}</span>
                            </Button>
                          )
                        })
                    )}
                  </div>
                ))}

              </div>
              <div className="mt-3 rounded-md bg-card/70 p-2 shadow-[var(--starbucks-card-shadow)]">
                <UserAccountMenu session={session} collapsed={false} />
              </div>
            </aside>
          </div>
        )}
      </>
    )
  }

  // ===============================
  // DESKTOP VIEW
  // ===============================

  return (
    <aside
      className={`flex h-screen flex-col bg-sidebar text-sidebar-foreground shadow-[var(--starbucks-nav-shadow)] transition-all ${collapsed ? "w-16" : "w-72"
        } duration-300`}
    >
      <div className="z-50 px-3 pt-3">
        <div className={`flex items-center gap-3 rounded-md bg-card px-3 py-3 shadow-[var(--starbucks-card-shadow)] ${collapsed ? "justify-center" : "justify-between"}`}>
          {/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                V
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">Vita FMS</div>
                <div className="truncate text-xs text-muted-foreground">Operations</div>
              </div>
            </div>
          )}
          <Button className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" variant="ghost" size="icon" onClick={toggle} >
            <Menu className="size-5" />
          </Button>
        </div>
        {!collapsed && (
          <div className="mt-3">
            <GlobalSearch collapsed={collapsed} />
          </div>
        )}
      </div>

      <nav className={`mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-8 ${collapsed ? "space-y-1" : "space-y-5"} ${SIDEBAR_SCROLL_CLASS}`}>

        <div className={`mb-2 ${collapsed ? "space-y-1" : "rounded-md bg-card/70 p-2 shadow-[var(--starbucks-card-shadow)]"}`}>
          {filteredNavFolders.map(folder => (
            <div key={folder.id} className={`text-sidebar-foreground/80 ${collapsed ? "" : "space-y-1 pb-3 last:pb-0"}`}>

              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={() => toggle()} // ⭐ expand sidebar
                      className="h-10 w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <folder.icon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{folder.title}</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <div className="px-2 text-xs font-medium text-sidebar-foreground/45">
                    {folder.title}
                  </div>

                  <div className="space-y-1">
                    {folder.items?.flatMap((group: any) =>
                      group.children
                        .filter((child: any) => child.url && child.url !== "#")
                        .map((child: any) => {
                          const Icon = getModuleIcon(child.title, child.type)

                          return (
                            <Button
                              key={`${folder.id}-${group.group}-${child.title}`}
                              variant="ghost"
                              className={`h-9 w-full justify-start rounded-md px-2 text-sm font-normal text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${pathname.startsWith(child.url)
                                ? ACTIVE_NAV_ITEM_CLASS
                                : ""
                                }`}
                              onClick={() => goTo(child.url)}
                            >
                              <Icon className="size-4 shrink-0 text-sidebar-foreground/65" />
                              <span className="truncate">{child.title}</span>
                            </Button>
                          )
                        })
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* {getValue("loading_s") && (
          <RefreshCw className="animate-spin size-4 fixed bottom-3 right-3" />
        )} */}

      </nav>
      <div className="shrink-0 px-3 pb-3 pt-3">
        <div className="rounded-md bg-card/70 p-2 shadow-[var(--starbucks-card-shadow)]">
          <UserAccountMenu session={session} collapsed={collapsed} />
        </div>
      </div>
    </aside>
  )
}

// ===============================
// PERMISSION FILTER
// ===============================

interface Permission {
  group_name: string
  title: string
  is_visible: boolean
}

export function filterNavFolders(navFolders: any[], permissions: Permission[]) {
  return navFolders
    .map(folder => ({
      ...folder,
      items: folder.items
        ?.map((group: any) => {
          const filteredChildren = group.children?.filter((child: any) =>
            permissions.some(
              p =>
                p.is_visible &&
                p.group_name === group.group &&
                p.title === child.title
            )
          )

          return filteredChildren?.length
            ? { ...group, children: filteredChildren }
            : null
        })
        .filter(Boolean),
    }))
    .filter(folder => folder.items?.length)
}
