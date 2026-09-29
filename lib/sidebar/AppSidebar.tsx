/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Boxes, ChevronDown, ExternalLink, FilePlus, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSidebar } from "./SidebarProvider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePathname, useRouter } from "next/navigation"
import { useGlobalContext } from "../context/GlobalContext"
import { NavFolders } from "../Defaults/DefaultValues"
import GlobalSearch from "@/components/ui/GlobalSearch"
import RefreshDataButton from "./RefreshDataButton"
import { db } from "../Supabase/supabaseClient"
import { Session } from "@supabase/supabase-js"
import UserAccountMenu from "../UserAccountMenu"
import { getModuleIcon } from "./moduleIcons"
import type { NavFolder, NavGroup } from "../types"
import { getProfileByAuthId } from "@/app/admin/user/api"
import { canInsertDocument, getNavigationPermissionTitle } from "./navigationPermissions"
import NotificationCenter from "@/components/notifications/NotificationCenter"

export { getNavigationPermissionTitle } from "./navigationPermissions"

type FilteredNavFolder = NavFolder & { items: NavGroup[] }

type SidebarAccessProfile = {
  user_type?: number | null
  fms_type?: string | null
  default_farm?: string | number | null
}

type SidebarFarm = {
  id?: string | number | null
  code?: string | null
  name?: string | null
}

const FMS_FOLDER_TITLES = new Set(["broiler", "hatchery", "breeder"])

const ACTIVE_NAV_ITEM_CLASS =
  "relative bg-primary/10 text-primary before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary before:content-['']"
const SIDEBAR_SCROLL_CLASS =
  "[scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

function routeIsActive(pathname: string, url: string) {
  return url !== "#" && (pathname === url || pathname.startsWith(`${url}/`))
}

function folderContainsRoute(folder: NavFolder, pathname: string) {
  return Boolean(
    folder.items?.some(group =>
      group.children.some(child => routeIsActive(pathname, child.url)),
    ),
  )
}

function getActiveNavigationUrl(folder: NavFolder | undefined, pathname: string) {
  return folder?.items
    ?.flatMap(group => group.children)
    .filter(child => !child.hideFromNavigation && routeIsActive(pathname, child.url))
    .sort((left, right) => right.url.length - left.url.length)[0]?.url ?? null
}

function getSidebarGroupLabel(group: string) {
  const normalizedGroup = group.trim().toLowerCase()
  if (normalizedGroup === "menus") return "Operations"
  if (normalizedGroup === "report") return "Reports"
  return group
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
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [preferredFmsFolder, setPreferredFmsFolder] = useState<string | null>(null)
  const [accessProfile, setAccessProfile] = useState<SidebarAccessProfile | null>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const mobileWasOpenedRef = useRef(false)

  const userInfo = getValue("UserInfoAuthSession")?.[0] as SidebarAccessProfile | undefined
  const farmList = (getValue("getFarmDB") ?? []) as SidebarFarm[]
  const rawFmsType = String(accessProfile?.fms_type ?? userInfo?.fms_type ?? "").trim().toLowerCase()
  const fmsTypeLabel = rawFmsType === "broiler"
    ? "Broiler"
    : rawFmsType === "breeder"
      ? "Breeder"
      : rawFmsType === "hatchery" || rawFmsType === "hatcher"
        ? "Hatchery"
        : null
  const sidebarTitle = fmsTypeLabel ? `Vita ${fmsTypeLabel}` : "Vita FMS"
  const defaultFarmReference = getValue("DefaultFarmId") ?? accessProfile?.default_farm ?? userInfo?.default_farm
  const defaultFarm = farmList.find(farm =>
    String(farm.id ?? "") === String(defaultFarmReference ?? "") ||
    String(farm.code ?? "").trim().toLowerCase() === String(defaultFarmReference ?? "").trim().toLowerCase(),
  )
  const defaultFarmName = String(defaultFarm?.name ?? "").trim() || "Default Farm"

  const filteredNavFolders = useMemo(
    () => filterNavFolders(NavFolders, userPermissions || [], accessProfile),
    [accessProfile, userPermissions],
  )

  const activeFolder = filteredNavFolders.find(folder => folder.id === activeFolderId)
  const activeNavigationUrl = getActiveNavigationUrl(activeFolder, pathname)

  useEffect(() => {
    const routeFolder = filteredNavFolders.find(folder => folderContainsRoute(folder, pathname))
    const fmsFolder = pathname === "/home"
      ? filteredNavFolders.find(folder => folder.title.toLowerCase() === preferredFmsFolder)
      : undefined

    // Keep the visible group aligned when navigation or permissions change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveFolderId(currentId =>
      fmsFolder?.id ?? routeFolder?.id ?? (filteredNavFolders.some(folder => folder.id === currentId) ? currentId : null),
    )
  }, [filteredNavFolders, pathname, preferredFmsFolder])

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
    if (!mobileOpen) {
      if (mobileWasOpenedRef.current) mobileTriggerRef.current?.focus()
      return
    }

    mobileWasOpenedRef.current = true

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }

    document.addEventListener("keydown", closeOnEscape)
    mobileCloseRef.current?.focus()
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [mobileOpen])

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await db.auth.getSession()
      setSession(session)

      if (!session?.user.id) return

      try {
        const profile = await getProfileByAuthId(session.user.id)
        setAccessProfile(profile)
        const fmsType = String(profile?.fms_type ?? "").trim().toLowerCase()
        setPreferredFmsFolder(FMS_FOLDER_TITLES.has(fmsType) ? fmsType : null)
      } catch (error) {
        console.error("Unable to load the user's FMS type:", error)
      }
    }
    getUser()
  }, [])

  // ===============================
  // ACTIONS
  // ===============================

  const goTo = (url: string) => {
    setValue("loading_s", true)
    setMobileOpen(false)
    router.push(url)
  }

  const prepareNavigation = () => {
    setValue("loading_s", true)
    setMobileOpen(false)
  }

  const openInNewWindow = (url: string) => {
    const newWindow = window.open(url, "_blank", "noopener,noreferrer")
    if (newWindow) newWindow.opener = null
  }


  const renderExpandedNavigation = () => {
    if (pathname === "/home") {
      if (!accessProfile || !Array.isArray(userPermissions)) {
        return (
          <p className="px-2 py-3 text-xs text-sidebar-foreground/55" role="status">
            Loading modules...
          </p>
        )
      }

      const hasModules = filteredNavFolders.some(folder =>
        folder.items.some(group =>
          group.children.some(child => child.url && child.url !== "#" && !child.hideFromNavigation),
        ),
      )

      if (!hasModules) {
        return (
          <div className="rounded-xl border border-dashed border-sidebar-border p-5 text-center">
            <Boxes className="mx-auto mb-2 size-6 text-sidebar-foreground/45" />
            <p className="text-sm font-medium">No modules assigned</p>
            <p className="mt-1 text-xs leading-5 text-sidebar-foreground/55">
              Your account does not have any modules assigned yet. Please contact your administrator to add modules to your account.
            </p>
          </div>
        )
      }
    }

    return (
    <>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Modules
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {filteredNavFolders.map(folder => {
          const Icon = folder.icon
          const isSelected = activeFolderId === folder.id
          const hasActiveRoute = folderContainsRoute(folder, pathname)

          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => setActiveFolderId(folder.id)}
              className={`group flex h-9 w-full min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 text-center text-[10px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : hasActiveRoute
                  ? "border-primary/30 bg-primary/5 text-sidebar-foreground"
                  : "border-transparent bg-muted/45 text-sidebar-foreground hover:border-primary/20 hover:bg-primary/5"
                }`}
              aria-expanded={isSelected}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{folder.title}</span>
            </button>
          )
        })}
      </div>

      {
        activeFolder ? (
          <div className="mt-4 border-t border-sidebar-border pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {activeFolder.title}
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {activeFolder.items?.reduce((count, group) => count + group.children.filter(child => child.url !== "#" && !child.hideFromNavigation).length, 0) ?? 0} modules
              </span>
            </div>

            <div className="space-y-5">
              {activeFolder.items?.map(group => {
                const visibleChildren = group.children.filter(child => child.url && child.url !== "#" && !child.hideFromNavigation)
                if (!visibleChildren.length) return null

                return (
                  <div key={`${activeFolder.id}-${group.group}`}>
                    {(activeFolder.items?.length ?? 0) > 1 && (
                      <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {getSidebarGroupLabel(group.group)}
                      </div>
                    )}
                    <div className="space-y-1">
                      {visibleChildren.map(child => {
                        const Icon = getModuleIcon(child.title, child.type)
                        const isCurrentRoute = child.url === activeNavigationUrl

                        return (
                          <div
                            key={`${activeFolder.id}-${group.group}-${child.title}`}
                            className="group/route relative"
                          >
                            <Button
                              asChild
                              variant="ghost"
                              className={`min-h-10 h-auto w-full justify-start rounded-lg px-3 py-2 pr-10 text-sm font-normal leading-5 hover:bg-primary/5 hover:text-foreground ${isCurrentRoute ? ACTIVE_NAV_ITEM_CLASS : "text-sidebar-foreground/80"}`}
                            >
                              <Link
                                href={child.url}
                                onClick={prepareNavigation}
                                aria-current={isCurrentRoute ? "page" : undefined}
                              >
                                <Icon className="size-[18px] shrink-0 text-current opacity-70" aria-hidden="true" />
                                <span className="min-w-0 whitespace-normal text-left">{child.title}</span>
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/60 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover/route:opacity-100 data-[state=open]:opacity-100"
                                  aria-label={`Options for ${child.title}`}
                                  title="Module options"
                                >
                                  <ChevronDown className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" side="right">
                                {canInsertDocument(child, userPermissions || [], Number(accessProfile?.user_type ?? 3)) && (
                                  <DropdownMenuItem onSelect={() => goTo(child.newDocumentUrl!)}>
                                    <FilePlus />
                                    New Document
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => openInNewWindow(child.url)}>
                                  <ExternalLink />
                                  Open to another tab
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-sidebar-border p-5 text-center">
            <Boxes className="mx-auto mb-2 size-6 text-sidebar-foreground/45" />
            <p className="text-sm font-medium">Choose a group</p>
            <p className="mt-1 text-xs leading-5 text-sidebar-foreground/55">
              The modules in the selected group will appear here.
            </p>
          </div>
        )
      }
    </>
    )
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
            ref={mobileTriggerRef}
            type="button"
            variant="ghost"
            onClick={() => setMobileOpen(true)}
            className="fixed left-3 top-3 z-50 border border-border bg-card/95 p-2 shadow-sm"
            aria-label="Open navigation"
            aria-expanded={false}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        )}

        {mobileOpen && (
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Application navigation"
              className="relative flex h-dvh w-[min(21rem,calc(100vw-2rem))] flex-col border-r border-sidebar-border bg-card text-sidebar-foreground shadow-xl"
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-sidebar-border px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  V
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{sidebarTitle}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate text-xs text-muted-foreground">{defaultFarmName}</div>
                    </TooltipTrigger>
                    <TooltipContent side="right">Default Farm</TooltipContent>
                  </Tooltip>
                </div>
                <Button
                  ref={mobileCloseRef}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="flex shrink-0 gap-2 border-b border-sidebar-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <GlobalSearch collapsed={false} />
                </div>
                <div className="w-9 shrink-0">
                  <RefreshDataButton collapsed />
                </div>
              </div>

              <nav className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 ${SIDEBAR_SCROLL_CLASS}`}>
                {renderExpandedNavigation()}
              </nav>

              <div className="shrink-0 border-t border-sidebar-border px-3 py-2">
                <NotificationCenter />
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
      className={`flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-card text-sidebar-foreground transition-[width] ${collapsed ? "w-16" : "w-[21rem]"
        } duration-300`}
    >
      <div className="z-50 shrink-0 border-b border-sidebar-border">
        <div className={`flex h-16 items-center gap-3 px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                V
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{sidebarTitle}</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="truncate text-xs text-muted-foreground">{defaultFarmName}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right">Default Farm</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
          <Button
            className="text-muted-foreground hover:bg-primary/5 hover:text-foreground"
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
              : <PanelLeftClose className="size-[18px]" aria-hidden="true" />}
          </Button>
        </div>
        {!collapsed && (
          <div className="flex gap-2 px-4 pb-3">
            <div className="min-w-0 flex-1">
              <GlobalSearch collapsed={false} />
            </div>
            <div className="w-9 shrink-0">
              <RefreshDataButton collapsed />
            </div>
          </div>
        )}
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto ${collapsed ? "space-y-1 px-2 py-3" : "px-4 py-4"} ${SIDEBAR_SCROLL_CLASS}`}>
        <div className={collapsed ? "space-y-1" : ""}>
          {collapsed && (
            <div className="text-sidebar-foreground/80">
              <GlobalSearch collapsed />
              <div className="mt-1">
                <RefreshDataButton collapsed />
              </div>
              <div className="my-3 border-t border-sidebar-border" />
            </div>
          )}

          {collapsed ? filteredNavFolders.map(folder => (
            <div key={folder.id} className="text-sidebar-foreground/80">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActiveFolderId(folder.id)
                      toggle()
                    }}
                    className={`h-10 w-full justify-center rounded-lg text-sidebar-foreground hover:bg-primary/5 hover:text-foreground ${folderContainsRoute(folder, pathname) ? ACTIVE_NAV_ITEM_CLASS : ""}`}
                    aria-label={folder.title}
                  >
                    <folder.icon className="size-5 text-current opacity-70" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{folder.title}</TooltipContent>
              </Tooltip>
            </div>
          )) : renderExpandedNavigation()}
        </div>

      </nav>
      <div className="shrink-0 border-t border-sidebar-border px-2 py-2">
        <NotificationCenter collapsed={collapsed} />
        <UserAccountMenu session={session} collapsed={collapsed} />
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

export function filterNavFolders(
  navFolders: NavFolder[],
  permissions: Permission[],
  profile?: { user_type?: number | null; fms_type?: string | null } | null,
): FilteredNavFolder[] {
  const userType = Number(profile?.user_type ?? 3)
  if (userType === 1) {
    return navFolders
      .map(folder => ({ ...folder, items: folder.items ?? [] }))
      .filter((folder): folder is FilteredNavFolder => Boolean(folder.items.length))
  }

  if (!profile?.fms_type) return []

  const fmsType = profile.fms_type as "Broiler" | "Breeder" | "Hatchery"

  return navFolders
    .filter(folder => Boolean(folder.fmsTypes?.includes(fmsType)))
    .map(folder => ({
      ...folder,
      items: folder.items
        ?.map((group: any) => {
          const filteredChildren = group.children?.filter((child: any) =>
            permissions.some(
              p =>
                p.is_visible &&
                p.group_name === group.group &&
                p.title === getNavigationPermissionTitle(child)
            )
          )

          return filteredChildren?.length
            ? { ...group, children: filteredChildren }
            : null
        })
        .filter(Boolean),
    }))
    .filter((folder): folder is FilteredNavFolder => Boolean(folder.items?.length))
}
