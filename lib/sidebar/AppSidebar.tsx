/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { Children, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, RefreshCw, ChevronDown } from "lucide-react"
import { useSidebar } from "./SidebarProvider"
import { VersionSwitcher } from "@/components/ui/sidebar/version-switcher"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePathname, useRouter } from "next/navigation"
import { useGlobalContext } from "../context/GlobalContext"
import { NavFolders } from "../Defaults/DefaultValues"
import GlobalSearch from "@/components/ui/GlobalSearch"
import ThemeSwitch from "../ThemeSwitch"
import { db } from "../Supabase/supabaseClient"
import { Session } from "@supabase/supabase-js"
import UserAccountMenu from "../UserAccountMenu"
import GlobalFarmUserSettings from "@/components/ui/GlobalFarmUserSettings"

const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()



  const { collapsed, toggle } = useSidebar()

  const { getValue, setValue } = useGlobalContext()

  const [session, setSession] = useState<Session | null>()
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // ⭐ ENTERPRISE: persistent open folders
  const [openFolders, setOpenFolders] = useState<number[]>([])

  const filteredNavFolders = filterNavFolders(
    NavFolders,
    getValue("UserPermission") || []
  )

  // ===============================
  // INIT
  // ===============================

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_open_folders")
    if (saved) setOpenFolders(JSON.parse(saved))
  }, [])

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
  }, [pathname])

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
            className="fixed z-50 left-3 top-3 p-2"
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

            <aside className="relative h-full w-72 bg-sidebar  shadow-lg p-3 ">

              {/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
              <GlobalSearch collapsed={false} />

              <div className="space-y-2 mt-4">

                {filteredNavFolders.map(folder => (
                  <div key={folder.id}>

                    <Button
                      variant="ghost"
                      className="w-full justify-between"
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
                      <div className="ml-6 mt-2 space-y-3">

                        {folder.items?.map((group: any, gi: number) => (
                          <div key={gi}>

                            <div className="text-xs text-muted-foreground  px-2">
                              {group.group}
                            </div>

                            {group.children
                              .filter((c: any) => c.url && c.url !== "#")
                              .map((child: any, ci: number) => (
                                <Button
                                  key={ci}
                                  variant="ghost"
                                  className={`w-full justify-start pl-4 ${pathname.startsWith(child.url)
                                    ? "bg-accent"
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

                {/* <ThemeSwitch collapsed={false} />
                <UserAccountMenu session={session} collapsed={false} /> */}

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
      className={`flex flex-col h-screen    bg-background transition-all ${collapsed ? "w-16" : "w-72"
        } duration-300`}
    >
      <div className="px-3   h-13.5  mt-1  z-50">
        <div className="flex items-center justify-between ">
          {/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
          <Button className="m-3 text-foreground" variant="ghost" size="icon" onClick={toggle} >
            <Menu className="size-5" />
          </Button>
          <div className="flex  gap-4">
            {!collapsed &&
              <GlobalSearch collapsed={collapsed} />
            }
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto   mt-9 space-y-2  ">

        <div className="bg-white shadow rounded-r-2xl min-h-[calc(100vh-7rem)] ">
          <div className="text-sm px-3 text-muted-foreground py-4">{!collapsed && "Main"} </div>
          {filteredNavFolders.map(folder => (
            <div key={folder.id} className="text-foreground/60">

              {/* HEADER */}
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={() => toggle()} // ⭐ expand sidebar
                      className="w-full justify-center "
                    >
                      <folder.icon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{folder.title}</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-6"
                  onClick={() => toggleFolder(folder.id)}
                >
                  <div className="flex items-center gap-2 hover:bg-primary/5 hover:text-primary p-1 w-full">
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
                <div className="ml-6 mt- space-y-3">

                  {folder.items?.map((group: any, gi: number) => (
                    <div key={gi}>

                      <div className="text-xs text-muted-foreground  ">
                        {group.group}
                      </div>

                      {group.children
                        .filter((c: any) => c.url && c.url !== "#")
                        .map((child: any, ci: number) => (
                          <Button
                            key={ci}
                            variant="ghost"
                            className={`h-7 w-full rounded-none justify-start hover:bg-primary/5 hover:text-primary   pl-4 ${pathname.startsWith(child.url)
                              ? "bg-accent"
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

        {/* <ThemeSwitch collapsed={collapsed} />
        <UserAccountMenu session={session} collapsed={false} /> */}

      </nav>
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
