"use client"

import { useMemo, useSyncExternalStore } from "react"
import { ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getLocalNotificationHistorySnapshot,
  readLocalNotificationHistory,
  subscribeToLocalNotificationHistory,
  type LocalNotificationHistoryItem,
  type LocalNotificationType,
} from "@/lib/notifications/localNotificationHistory"

const typeStyles: Record<LocalNotificationType, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-800",
  info: "border-sky-300 bg-sky-50 text-sky-800",
  loading: "border-sky-300 bg-sky-50 text-sky-800",
  default: "border-border bg-muted text-foreground",
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

export default function LocalNotificationHistory({ onOpenItem }: { onOpenItem?: () => void }) {
  const router = useRouter()
  const snapshot = useSyncExternalStore(
    subscribeToLocalNotificationHistory,
    getLocalNotificationHistorySnapshot,
    () => "",
  )
  const history = useMemo(() => snapshot ? readLocalNotificationHistory() : [], [snapshot])

  if (history.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        No local message history yet. New toast messages will appear here.
      </div>
    )
  }

  function openItem(item: LocalNotificationHistoryItem) {
    onOpenItem?.()
    router.push(item.targetUrl)
  }

  return (
    <Table containerClassName="rounded-md border" className="min-w-[760px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-44">Date-Time</TableHead>
          <TableHead className="w-28">Notification Type</TableHead>
          <TableHead>Notification</TableHead>
          <TableHead className="w-44">Module [triggered by]</TableHead>
          <TableHead className="w-20 text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="text-xs text-muted-foreground">
              {dateTimeFormatter.format(new Date(item.occurredAt))}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={typeStyles[item.type]}>{item.type}</Badge>
            </TableCell>
            <TableCell className="overflow-hidden">
              <div className="truncate" title={item.message}>{item.message}</div>
            </TableCell>
            <TableCell className="overflow-hidden">
              <div className="truncate" title={`${item.moduleLabel} (${item.targetUrl})`}>{item.moduleLabel}</div>
            </TableCell>
            <TableCell className="text-right">
              <Button type="button" size="sm" variant="ghost" onClick={() => openItem(item)}>
                <ExternalLink className="size-3.5" />
                Open
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
