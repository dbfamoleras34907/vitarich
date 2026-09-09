"use client"

import { useEffect, useMemo, useState } from "react"
import { BellRing, CheckCheck, RefreshCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import NotificationList from "@/components/notifications/NotificationList"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getNotificationInbox,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  processPendingNotificationsRequest,
} from "@/lib/data/repositories/notificationApiClient"
import type { NotificationInboxItem } from "@/lib/notifications/types"

export default function NotificationInbox() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationInboxItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      await processPendingNotificationsRequest().catch(() => undefined)
      const result = await getNotificationInbox(100)
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load notifications.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const visibleNotifications = useMemo(
    () => filter === "unread" ? notifications.filter(item => !item.read_at) : notifications,
    [filter, notifications],
  )

  async function openNotification(notification: NotificationInboxItem) {
    if (!notification.read_at) {
      await markNotificationReadRequest(notification.id).catch(() => undefined)
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
      setUnreadCount(current => Math.max(0, current - 1))
    }
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

  return (
    <div className="min-h-[calc(100vh-120px)] bg-background px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle className="flex items-center gap-2 text-xl"><BellRing className="size-5" />Notification Inbox</CardTitle><CardDescription className="mt-1">Review module events addressed to your account.</CardDescription></div>
              <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void refresh()}><RefreshCcw className="size-4" />Refresh</Button><Button type="button" variant="outline" size="sm" disabled={unreadCount === 0} onClick={() => void markAllRead()}><CheckCheck className="size-4" />Mark all read</Button></div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={value => setFilter(value as "all" | "unread")}>
              <TabsList className="mb-4"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger></TabsList>
            </Tabs>
            {loading ? <div className="space-y-2">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div> : (
              <NotificationList notifications={visibleNotifications} onOpen={notification => void openNotification(notification)} emptyMessage={filter === "unread" ? "No unread notifications." : "No notifications."} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
