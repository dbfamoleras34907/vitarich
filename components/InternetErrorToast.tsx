'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  INTERNET_ERROR_EVENT,
  INTERNET_ERROR_MESSAGE,
  isInternetError,
  notifyInternetError,
} from '@/lib/networkError'

const TOAST_ID = 'internet-error'

export default function InternetErrorToast() {
  useEffect(() => {
    const showInternetError = () => {
      toast.error(INTERNET_ERROR_MESSAGE, { id: TOAST_ID })
    }

    const handleOffline = () => {
      notifyInternetError()
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isInternetError(event.reason)) {
        notifyInternetError(event.reason)
      }
    }

    window.addEventListener(INTERNET_ERROR_EVENT, showInternetError)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener(INTERNET_ERROR_EVENT, showInternetError)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
