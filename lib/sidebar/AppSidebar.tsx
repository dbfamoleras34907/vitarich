/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, ChevronDown } from "lucide-react"
import { useSidebar } from "./SidebarProvider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePathname, useRouter } from "next/navigation"
import { useGlobalContext } from "../context/GlobalContext"
import { NavFolders } from "../Defaults/DefaultValues"
import GlobalSearch from "@/components/ui/GlobalSearch"
import { db } from "../Supabase/supabaseClient"
import { Session } from "@supabase/supabase-js"
import UserAccountMenu from "../UserAccountMenu"

const ACTIVE_NAV_ITEM_CLASS =
  "relative bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-primary before:content-['']"

const getSavedOpenFolders = () => {
  if (typeof window === "undefined") return []

  try {
    return JSON.parse(localStorage.getItem("sidebar_open_folders") || "[]")
  } catch {
    return []
  }
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()



  const { collapsed, toggle } = useSidebar()

  const { getValue, setValue } = useGlobalContext()
  const userPermissions = getValue("UserPermission")

  const [session, setSession] = useState<Session | null>()
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // ⭐ ENTERPRISE: persistent open folders
  const [openFolders, setOpenFolders] = useState<number[]>(getSavedOpenFolders)

  const filteredNavFolders = useMemo(
    () => filterNavFolders(NavFolders, userPermissions || []),
    [userPermissions],
  )

  // ===============================
  // INIT
  // ===============================

  useEffect(() => {
    localStorage.setItem("sidebar_open_folders", JSON.stringify(openFolders))
  }, [openFolders])

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
  // AUTO-OPEN FOLDER BASED ON ROUTE
  // ===============================

  useEffect(() => {
    filteredNavFolders.forEach(folder => {
      folder.items?.forEach((group: any) => {
        group.children?.forEach((child: any) => {
          if (child.url && child.url !== "#" && pathname.startsWith(child.url)) {
            setOpenFolders(prev =>
              prev.includes(folder.id) ? prev : [...prev, folder.id]
            )
          }
        })
      })
    })
  }, [filteredNavFolders, pathname])

  // ===============================
  // ACTIONS
  // ===============================

  const toggleFolder = (id: number) => {
    setOpenFolders(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

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
            className="fixed z-50 left-3 top-3 bg-white/95 p-2 shadow-[var(--starbucks-nav-shadow)]"
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
              <div className="mb-3 flex items-center gap-3 rounded-md bg-white px-3 py-3 shadow-[var(--starbucks-card-shadow)]">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  V
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">Vita FMS</div>
                  <div className="truncate text-xs text-muted-foreground">Operations</div>
                </div>
              </div>
              <GlobalSearch collapsed={false} />

              <div className="mt-4 max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto rounded-md bg-white/70 p-2 pb-6 shadow-[var(--starbucks-card-shadow)]">

                {filteredNavFolders.map(folder => (
                  <div key={folder.id}>

                    <Button
                      variant="ghost"
                      className="h-10 w-full justify-between px-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <div className="flex items-center gap-2">
                        <folder.icon className="size-5" />
                        {folder.title}
                      </div>

                      <ChevronDown
                        className={`size-4 transition ${openFolders.includes(folder.id) ? "rotate-180" : ""
                          }`}
                      />
                    </Button>

                    {openFolders.includes(folder.id) && (
                      <div className="mt-2 space-y-1 pl-3">

                        {folder.items?.map((group: any, gi: number) => (
                          <div key={gi}>

                            <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                              {group.group}
                            </div>

                            {group.children
                              .filter((c: any) => c.url && c.url !== "#")
                              .map((child: any, ci: number) => (
                                <Button
                                  key={ci}
                                  variant="ghost"
                                  className={`h-9 w-full justify-start px-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${pathname.startsWith(child.url)
                                    ? ACTIVE_NAV_ITEM_CLASS
                                    : ""
                                    }`}
                                  onClick={() => goTo(child.url)}
                                >
                                  {child.title}
                                </Button>
                              ))}
                          </div>
                        ))}

                      </div>
                    )}
                  </div>
                ))}

              </div>
              <div className="mt-3 rounded-md bg-white/70 p-2 shadow-[var(--starbucks-card-shadow)]">
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
        <div className={`flex items-center gap-3 rounded-md bg-white px-3 py-3 shadow-[var(--starbucks-card-shadow)] ${collapsed ? "justify-center" : "justify-between"}`}>
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

      <nav className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-8">

        <div className="mb-2 rounded-md bg-white/70 p-2 shadow-[var(--starbucks-card-shadow)]">
          <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/55">{!collapsed && "Navigation"} </div>
          {filteredNavFolders.map(folder => (
            <div key={folder.id} className="text-sidebar-foreground/80">

              {/* HEADER */}
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
                <Button
                  variant="ghost"
                  className={`h-10 w-full justify-between px-3 font-semibold text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${folder.items?.some((group: any) => group.children?.some((child: any) => child.url && child.url !== "#" && pathname.startsWith(child.url))) ? "bg-white text-foreground shadow-[var(--starbucks-card-shadow)]" : ""}`}
                  onClick={() => toggleFolder(folder.id)}
                >
                  <div className="flex w-full items-center gap-2">
                    <folder.icon className="size-5" />
                    {folder.title}
                  </div>

                  <ChevronDown
                    className={`size-4 transition ${openFolders.includes(folder.id) ? "rotate-180" : ""
                      }`}
                  />
                </Button>
              )}

              {/* CONTENT */}
              {!collapsed && openFolders.includes(folder.id) && (
                <div className="mt-2 space-y-4 pb-2 pl-3">

                  {folder.items?.map((group: any, gi: number) => (
                    <div key={gi}>

                      <div className="px-3 py-1 text-xs font-semibold uppercase text-sidebar-foreground/45">
                        {group.group}
                      </div>

                      {group.children
                        .filter((c: any) => c.url && c.url !== "#")
                        .map((child: any, ci: number) => (
                          <Button
                            key={ci}
                            variant="ghost"
                            className={`h-9 w-full justify-start px-3 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${pathname.startsWith(child.url)
                              ? ACTIVE_NAV_ITEM_CLASS
                              : ""
                              }`}
                            onClick={() => goTo(child.url)}
                          >
                            {child.title}
                          </Button>
                        ))}
                    </div>
                  ))}

                </div>
              )}
            </div>
          ))}
        </div>

        {/* {getValue("loading_s") && (
          <RefreshCw className="animate-spin size-4 fixed bottom-3 right-3" />
        )} */}

      </nav>
      <div className="shrink-0 px-3 pb-3 pt-3">
        <div className="rounded-md bg-white/70 p-2 shadow-[var(--starbucks-card-shadow)]">
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
