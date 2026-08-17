'use client'

import { useEffect, useState } from 'react'
import {
  INTERNET_ERROR_EVENT,
  INTERNET_ERROR_MESSAGE,
  isInternetError,
  notifyInternetError,
} from '@/lib/networkError'

export default function InternetErrorToast() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const showInternetError = () => {
      setIsOffline(true)
    }

    const handleOffline = () => {
      setIsOffline(true)
      notifyInternetError()
    }

    const handleOnline = () => {
      setIsOffline(false)
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isInternetError(event.reason)) {
        event.preventDefault()
        setIsOffline(true)
        notifyInternetError(event.reason)
      }
    }

    window.addEventListener(INTERNET_ERROR_EVENT, showInternetError)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener(INTERNET_ERROR_EVENT, showInternetError)
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
