"use client"

import { isValidElement, useEffect, useRef, useState, type ReactNode } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { useSonner, type ToastT } from "sonner"
import { usePathname } from "next/navigation"
import {
  appendLocalNotificationHistory,
  type LocalNotificationType,
} from "@/lib/notifications/localNotificationHistory"
import { useSidebar } from "@/lib/sidebar/SidebarProvider"

type StatusItem = Pick<ToastT, "id" | "type" | "title" | "description">

const STATUS_MESSAGE_DURATION_MS = 60_000
const SIDEBAR_HIDDEN_ROUTES = new Set(["/signup_update", "/login", "/signup", "/logout"])

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

function contentText(content: ReactNode): string {
  if (content === null || content === undefined || typeof content === "boolean") return ""
  if (typeof content === "string" || typeof content === "number") return String(content)
  if (Array.isArray(content)) return content.map(contentText).filter(Boolean).join(" ")
  if (isValidElement<{ children?: ReactNode }>(content)) return contentText(content.props.children)
  return ""
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
  const pathname = usePathname()
  const { collapsed } = useSidebar()
  const [current, setCurrent] = useState<StatusItem | null>(null)
  const observedIds = useRef(new Set<ToastT["id"]>())

  useEffect(() => {
    const activeIds = new Set(toasts.map((toast) => toast.id))
    for (const id of observedIds.current) {
      if (!activeIds.has(id)) observedIds.current.delete(id)
    }

    const additions = [...toasts]
      .reverse()
      .filter((toast) => !toast.jsx && !observedIds.current.has(toast.id))
      .map(toStatusItem)

    for (const item of additions) observedIds.current.add(item.id)

    for (const item of additions) {
      const title = contentText(resolveContent(item.title))
      const description = contentText(resolveContent(item.description))
      const message = [title, description].filter(Boolean).join(" ").trim()
      if (!message) continue

      const targetUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const routeFallback = window.location.pathname.split("/").filter(Boolean).join(" / ") || "Home"
      const moduleLabel = document.title.trim() && document.title !== "Vita FMS" ? document.title.trim() : routeFallback
      appendLocalNotificationHistory({
        type: normalizeType(item.type) as LocalNotificationType,
        message,
        moduleLabel,
        targetUrl,
      })
    }

    setCurrent((currentItem) => {
      const activeById = new Map(toasts.map((toast) => [toast.id, toast]))
      const updatedToast = currentItem ? activeById.get(currentItem.id) : undefined
      const updatedCurrent = updatedToast ? toStatusItem(updatedToast) : currentItem
      const latestAddition = additions[additions.length - 1]

      return latestAddition ?? updatedCurrent
    })
  }, [toasts])

  const currentId = current?.id

  useEffect(() => {
    if (currentId === undefined) return

    const timeoutId = window.setTimeout(() => {
      setCurrent((currentItem) => currentItem?.id === currentId ? null : currentItem)
    }, STATUS_MESSAGE_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [currentId])

  if (!current) return null

  const type = normalizeType(current.type)
  const title = resolveContent(current.title)
  const description = resolveContent(current.description)
  const sidebarOffset = SIDEBAR_HIDDEN_ROUTES.has(pathname)
    ? "lg:left-0"
    : collapsed
      ? "lg:left-16"
      : "lg:left-[21rem]"

  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-[1000000000] hidden h-8 items-center gap-2 border-t px-3 text-xs shadow-[0_-2px_8px_rgb(0_0_0/0.16)] transition-[left] duration-200 lg:flex print:hidden ${sidebarOffset} ${statusStyles[type]}`}
      role={type === "error" || type === "warning" ? "alert" : "status"}
      aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {statusIcon(type)}
      <div className="min-w-0 flex-1 truncate font-medium">
        {title}
        {description ? <span className="ml-1 font-normal opacity-90">{description}</span> : null}
      </div>
      <button
        type="button"
        className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-sm text-current hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
        onClick={() => setCurrent(null)}
        aria-label="Close status message"
      >
        <XIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
