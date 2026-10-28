"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { useSonner, type ToastT } from "sonner"

type StatusItem = Pick<ToastT, "id" | "type" | "title" | "description">

const statusStyles = {
  success: "border-emerald-800 bg-emerald-700 text-white",
  warning: "border-amber-500 bg-amber-400 text-amber-950",
  error: "border-red-800 bg-red-700 text-white",
  info: "border-sky-800 bg-sky-700 text-white",
  loading: "border-sky-800 bg-sky-700 text-white",
  default: "border-slate-700 bg-slate-600 text-white",
} as const

function normalizeType(type: ToastT["type"]): keyof typeof statusStyles {
  if (type === "success" || type === "warning" || type === "error" || type === "info" || type === "loading") {
    return type
  }

  return "default"
}

function statusIcon(type: keyof typeof statusStyles) {
  const className = "size-4 shrink-0"

  if (type === "success") return <CircleCheckIcon className={className} aria-hidden="true" />
  if (type === "warning") return <TriangleAlertIcon className={className} aria-hidden="true" />
  if (type === "error") return <OctagonXIcon className={className} aria-hidden="true" />
  if (type === "loading") return <Loader2Icon className={`${className} animate-spin`} aria-hidden="true" />
  return <InfoIcon className={className} aria-hidden="true" />
}

function resolveContent(content: StatusItem["title"] | StatusItem["description"]): ReactNode {
  return typeof content === "function" ? content() : content
}

function toStatusItem(toast: ToastT): StatusItem {
  return {
    id: toast.id,
    type: toast.type,
    title: toast.title,
    description: toast.description,
  }
}

export function DesktopStatusBar() {
  const { toasts } = useSonner()
  const [queue, setQueue] = useState<StatusItem[]>([])
  const observedIds = useRef(new Set<ToastT["id"]>())

  useEffect(() => {
    const activeIds = new Set(toasts.map((toast) => toast.id))
    for (const id of observedIds.current) {
      if (!activeIds.has(id)) observedIds.current.delete(id)
    }

    setQueue((currentQueue) => {
      const activeById = new Map(toasts.map((toast) => [toast.id, toast]))
      const currentIds = new Set(currentQueue.map((item) => item.id))
      const updatedQueue = currentQueue.map((item) => {
        const updatedToast = activeById.get(item.id)
        return updatedToast ? toStatusItem(updatedToast) : item
      })

      const additions = [...toasts]
        .reverse()
        .filter((toast) => !toast.jsx && !currentIds.has(toast.id) && !observedIds.current.has(toast.id))
        .map((toast) => {
          observedIds.current.add(toast.id)
          return toStatusItem(toast)
        })

      return additions.length ? [...updatedQueue, ...additions] : updatedQueue
    })
  }, [toasts])

  const current = queue[0]
  if (!current) return null

  const type = normalizeType(current.type)
  const title = resolveContent(current.title)
  const description = resolveContent(current.description)
  const queuedCount = queue.length - 1

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[1000000000] hidden h-8 items-center gap-2 border-t px-3 text-xs shadow-[0_-2px_8px_rgb(0_0_0/0.16)] lg:flex print:hidden ${statusStyles[type]}`}
      role={type === "error" || type === "warning" ? "alert" : "status"}
      aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {statusIcon(type)}
      <div className="min-w-0 flex-1 truncate font-medium">
        {title}
        {description ? <span className="ml-1 font-normal opacity-90">{description}</span> : null}
      </div>
      {queuedCount > 0 ? (
        <span className="shrink-0 tabular-nums opacity-85">{queuedCount} queued</span>
      ) : null}
      <button
        type="button"
        className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-sm text-current hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
        onClick={() => setQueue((currentQueue) => currentQueue.slice(1))}
        aria-label="Close status message"
      >
        <XIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
