"use client"

import { AlertTriangle, BellRing, CircleCheck, Info } from "lucide-react"
import type { NotificationInboxItem } from "@/lib/notifications/types"

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime()
  const difference = Date.now() - timestamp
  if (!Number.isFinite(timestamp)) return ""
  if (difference < 60_000) return "Just now"
  if (difference < 3_600_000) return `${Math.max(1, Math.floor(difference / 60_000))}m ago`
  if (difference < 86_400_000) return `${Math.floor(difference / 3_600_000)}h ago`
  if (difference < 604_800_000) return `${Math.floor(difference / 86_400_000)}d ago`
  return new Date(value).toLocaleString()
}

function PriorityIcon({ priority }: { priority: NotificationInboxItem["priority"] }) {
  if (priority === "critical") return <AlertTriangle className="size-4 text-destructive" />
  if (priority === "high") return <BellRing className="size-4 text-amber-600" />
  if (priority === "low") return <Info className="size-4 text-muted-foreground" />
  return <CircleCheck className="size-4 text-primary" />
}

export default function NotificationList({
  notifications,
  onOpen,
  emptyMessage = "No notifications.",
}: {
  notifications: NotificationInboxItem[]
  onOpen: (notification: NotificationInboxItem) => void
  emptyMessage?: string
}) {
  if (notifications.length === 0) {
    return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="divide-y rounded-md border">
      {notifications.map(notification => (
        <button
          key={notification.id}
          type="button"
          disabled
          aria-disabled="true"
          onClick={() => onOpen(notification)}
          className={`flex w-full cursor-default gap-3 p-3 text-left ${notification.read_at ? "bg-background" : "bg-primary/5"}`}
        >
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <PriorityIcon priority={notification.priority} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className={`truncate text-sm ${notification.read_at ? "font-medium" : "font-semibold"}`}>{notification.title}</p>
              {!notification.read_at && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{notification.module_key.replaceAll("_", " ")}</span>
              <time dateTime={notification.occurred_at}>{relativeTime(notification.occurred_at)}</time>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
