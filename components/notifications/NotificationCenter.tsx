"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, CheckCheck, ExternalLink, History, Maximize2, Minimize2, RefreshCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import NotificationList from "./NotificationList"
import LocalNotificationHistory from "./LocalNotificationHistory"
import {
  getNotificationInbox,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  markNotificationsSeenRequest,
} from "@/lib/data/repositories/notificationApiClient"
import type { NotificationInboxItem } from "@/lib/notifications/types"
import { db } from "@/lib/Supabase/supabaseClient"

function dedupe(items: NotificationInboxItem[]) {
  const byId = new Map<number, NotificationInboxItem>()
  items.forEach(item => byId.set(item.id, item))
  return Array.from(byId.values()).sort((left, right) =>
    new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime()
  )
}

export default function NotificationCenter({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter()
  const [authId, setAuthId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"notifications" | "history">("notifications")
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [notifications, setNotifications] = useState<NotificationInboxItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async (showError = false) => {
    if (!authId || refreshInFlight.current) return
    refreshInFlight.current = true
    setLoading(true)
    try {
      const result = await getNotificationInbox(25)
      setNotifications(dedupe(result.notifications))
      setUnreadCount(result.unreadCount)
    } catch (error) {
      if (showError) toast.error(error instanceof Error ? error.message : "Unable to load notifications.")
    } finally {
      refreshInFlight.current = false
      setLoading(false)
    }
  }, [authId])

  useEffect(() => {
    void db.auth.getSession().then(({ data }) => setAuthId(data.session?.user.id ?? null))
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => setAuthId(session?.user.id ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authId) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    void refresh()
  }, [authId, refresh])

  const unreadLabel = useMemo(() => unreadCount > 99 ? "99+" : String(unreadCount), [unreadCount])

  async function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      await markNotificationsSeenRequest().catch(() => undefined)
    }
  }

  async function openNotification(notification: NotificationInboxItem) {
    if (!notification.read_at) {
      await markNotificationReadRequest(notification.id).catch(() => undefined)
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
      setUnreadCount(current => Math.max(0, current - 1))
    }
    setOpen(false)
    if (notification.target_url) router.push(notification.target_url)
  }

  async function markAllRead() {
    try {
      await markAllNotificationsReadRequest()
      const readAt = new Date().toISOString()
      setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at ?? readAt })))
      setUnreadCount(0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark notifications as read.")
    }
  }

  if (!authId) return null

  const notificationButton = (
    <Button
      type="button"
      variant="ghost"
      onClick={() => void changeOpen(true)}
      className={`relative h-10 w-full rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "justify-center px-0" : "justify-start gap-3 px-3"}`}
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
    >
      <Bell className="size-5 shrink-0 text-sidebar-foreground/70" />
      {!collapsed && <span className="truncate">Notifications</span>}
      {unreadCount > 0 && (
        <span className={collapsed
          ? "absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-4 text-white"
          : "ml-auto flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-5 text-white"
        }>
          {unreadLabel}
        </span>
      )}
    </Button>
  )

  return (
    <div className="w-full print:hidden">
      <Sheet open={open} onOpenChange={nextOpen => void changeOpen(nextOpen)}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{notificationButton}</TooltipTrigger>
            <TooltipContent side="right">Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ""}</TooltipContent>
          </Tooltip>
        ) : notificationButton}
        <SheetContent
          side="left"
          showCloseButton={false}
          className={`w-full gap-0 transition-[max-width] duration-200 ${activeTab === "history" && historyExpanded ? "sm:max-w-5xl" : activeTab === "history" ? "sm:max-w-xl lg:max-w-2xl" : "sm:max-w-md"}`}
        >
          <SheetHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SheetTitle>{activeTab === "notifications" ? "Notifications" : "Message History"}</SheetTitle>
                <SheetDescription>
                  {activeTab === "notifications"
                    ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                    : "Toast messages stored only in this browser."}
                </SheetDescription>
              </div>
              {activeTab === "notifications" ? <div className="flex flex-wrap justify-end gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={() => void refresh(true)}>
                  <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Refreshing" : "Refresh"}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={unreadCount === 0} onClick={() => void markAllRead()}><CheckCheck className="size-4" />Mark all read</Button>
              </div> : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setHistoryExpanded(current => !current)}
                  aria-label={historyExpanded ? "Collapse message history" : "Expand message history"}
                >
                  {historyExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                  {historyExpanded ? "Collapse" : "Expand"}
                </Button>
              )}
            </div>
            <Tabs value={activeTab} onValueChange={value => setActiveTab(value as "notifications" | "history")}>
              <TabsList variant="line" className="mt-2 h-8">
                <TabsTrigger value="notifications"><Bell className="size-4" />Notifications</TabsTrigger>
                <TabsTrigger value="history"><History className="size-4" />Message History</TabsTrigger>
              </TabsList>
            </Tabs>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {activeTab === "history" ? <LocalNotificationHistory onOpenItem={() => setOpen(false)} /> : loading ? <div className="space-y-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div> : (
              <NotificationList notifications={notifications} onOpen={notification => void openNotification(notification)} />
            )}
          </div>
          {activeTab === "notifications" ? <div className="border-t p-3">
            <Button type="button" variant="outline" className="w-full" onClick={() => { setOpen(false); router.push("/notifications") }}>
              <ExternalLink className="size-4" />View all notifications
            </Button>
          </div> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
