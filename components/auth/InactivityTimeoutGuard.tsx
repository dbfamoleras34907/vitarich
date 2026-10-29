"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Clock3 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getInactivityWarningMilliseconds,
  INACTIVITY_LOGOUT_STORAGE_KEY,
  INACTIVITY_SETTINGS_EVENT,
  LAST_ACTIVITY_STORAGE_KEY,
  readInactivityTimeoutMinutes,
  readLastUserActivity,
  recordUserActivity,
} from "@/lib/auth/inactivityTimeout"

const PUBLIC_ROUTES = new Set([
  "/",
  "/about",
  "/login",
  "/logout",
  "/signup",
  "/timeout",
])

const ACTIVITY_WRITE_THROTTLE_MILLISECONDS = 1_000

export default function InactivityTimeoutGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const enabled = !PUBLIC_ROUTES.has(pathname)
  const lastActivityRef = useRef(0)
  const lastStorageWriteRef = useRef(0)
  const previousEnabledRef = useRef(enabled)
  const logoutStartedRef = useRef(false)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)

  const markActivity = useCallback((forceStorageWrite = false) => {
    const now = Date.now()
    lastActivityRef.current = now
    setSecondsRemaining(null)

    if (forceStorageWrite || now - lastStorageWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MILLISECONDS) {
      lastStorageWriteRef.current = recordUserActivity(now)
    }
  }, [])

  const startTimeoutLogout = useCallback(() => {
    if (logoutStartedRef.current) return

    logoutStartedRef.current = true
    window.localStorage.setItem(INACTIVITY_LOGOUT_STORAGE_KEY, String(Date.now()))
    router.replace("/timeout")
  }, [router])

  useEffect(() => {
    if (!enabled) {
      previousEnabledRef.current = false
      logoutStartedRef.current = false
      return
    }

    if (!previousEnabledRef.current) {
      const timestamp = recordUserActivity()
      lastActivityRef.current = timestamp
      lastStorageWriteRef.current = timestamp
    } else {
      const storedActivity = readLastUserActivity()
      const initialActivity = storedActivity ?? recordUserActivity()
      lastActivityRef.current = initialActivity
      lastStorageWriteRef.current = initialActivity
    }
    previousEnabledRef.current = true

    const handleActivity = () => markActivity()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY) {
        const timestamp = Number(event.newValue)
        if (Number.isFinite(timestamp) && timestamp > lastActivityRef.current) {
          lastActivityRef.current = timestamp
          setSecondsRemaining(null)
        }
        return
      }

      if (event.key === INACTIVITY_LOGOUT_STORAGE_KEY && event.newValue) {
        logoutStartedRef.current = true
        router.replace("/timeout")
      }
    }

    const checkInactivity = () => {
      const timeoutMilliseconds = readInactivityTimeoutMinutes() * 60_000
      const warningMilliseconds = getInactivityWarningMilliseconds(timeoutMilliseconds)
      const remainingMilliseconds = timeoutMilliseconds - (Date.now() - lastActivityRef.current)

      if (remainingMilliseconds <= 0) {
        startTimeoutLogout()
        return
      }

      setSecondsRemaining(
        remainingMilliseconds <= warningMilliseconds
          ? Math.max(1, Math.ceil(remainingMilliseconds / 1_000))
          : null,
      )
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      "keydown",
      "mousedown",
      "mousemove",
      "touchstart",
      "touchmove",
    ]
    activityEvents.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }))
    window.addEventListener("storage", handleStorage)
    window.addEventListener(INACTIVITY_SETTINGS_EVENT, checkInactivity)
    checkInactivity()
    const interval = window.setInterval(checkInactivity, 1_000)

    return () => {
      activityEvents.forEach(eventName => window.removeEventListener(eventName, handleActivity))
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(INACTIVITY_SETTINGS_EVENT, checkInactivity)
      window.clearInterval(interval)
    }
  }, [enabled, markActivity, router, startTimeoutLogout])

  if (!enabled) return null

  return (
    <Dialog open={secondsRemaining !== null}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onEscapeKeyDown={event => event.preventDefault()}>
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Clock3 className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle>Session ending soon</DialogTitle>
          <DialogDescription>
            You will be signed out after {secondsRemaining ?? 0} second{secondsRemaining === 1 ? "" : "s"} because no mouse, keyboard, or touch activity was detected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => markActivity(true)} autoFocus>
            Continue session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
