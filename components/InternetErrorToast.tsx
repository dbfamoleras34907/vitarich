'use client'

import { useEffect, useState } from 'react'
import {
  INTERNET_ERROR_CONFIRMATION_MS,
  INTERNET_ERROR_EVENT,
  INTERNET_ERROR_MESSAGE,
  INTERNET_RESTORED_EVENT,
  isInternetError,
  notifyInternetError,
  notifyInternetRestored,
} from '@/lib/networkError'

export default function InternetErrorToast() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    let confirmationTimer: ReturnType<typeof setTimeout> | null = null

    const cancelConfirmation = () => {
      if (confirmationTimer === null) return
      clearTimeout(confirmationTimer)
      confirmationTimer = null
    }

    const showInternetError = () => {
      if (confirmationTimer !== null) return

      confirmationTimer = setTimeout(() => {
        confirmationTimer = null
        setIsOffline(true)
      }, INTERNET_ERROR_CONFIRMATION_MS)
    }

    const handleOffline = () => {
      showInternetError()
      notifyInternetError()
    }

    const handleOnline = () => {
      cancelConfirmation()
      setIsOffline(false)
      notifyInternetRestored()
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isInternetError(event.reason)) {
        event.preventDefault()
        showInternetError()
        notifyInternetError(event.reason)
      }
    }

    window.addEventListener(INTERNET_ERROR_EVENT, showInternetError)
    window.addEventListener(INTERNET_RESTORED_EVENT, handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    if (navigator.onLine === false) {
      handleOffline()
    }

    return () => {
      cancelConfirmation()
      window.removeEventListener(INTERNET_ERROR_EVENT, showInternetError)
      window.removeEventListener(INTERNET_RESTORED_EVENT, handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-x-0 top-0 z-[9999] flex h-7 items-center justify-center bg-destructive px-3 text-center text-xs font-medium text-white shadow-sm"
    >
      {INTERNET_ERROR_MESSAGE}
    </div>
  )
}
