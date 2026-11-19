'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { Toast } from './Toast'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_INTERVAL = 30_000 // 30 seconds
const ACTIVITY_TIMEOUT = 30_000 // Consider idle after 30s of no interaction

export function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [visible, setVisible] = useState(false)
  const buildIdRef = useRef<string | null>(null)
  const newBuildIdRef = useRef<string | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const dismissedBuildRef = useRef<string | null>(null)

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' })
      if (!res.ok) return

      const { buildId } = await res.json()

      // Skip 'development' — no version polling in dev
      if (buildId === 'development') return

      // First fetch — store the initial build ID
      if (buildIdRef.current === null) {
        buildIdRef.current = buildId
        return
      }

      // Build changed and user hasn't dismissed this specific version
      if (buildId !== buildIdRef.current && buildId !== dismissedBuildRef.current) {
        newBuildIdRef.current = buildId
        setUpdateAvailable(true)
        // Small delay so the toast animates in after render
        requestAnimationFrame(() => setVisible(true))
      }
    } catch {
      // Network error — silently skip this poll
    }
  }, [])

  useEffect(() => {
    // Track user activity
    const markActive = () => {
      lastActivityRef.current = Date.now()
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    activityEvents.forEach((event) => {
      document.addEventListener(event, markActive, { passive: true })
    })

    // Poll on interval, but only when user is active and tab is visible
    const interval = setInterval(() => {
      const isActive = Date.now() - lastActivityRef.current < ACTIVITY_TIMEOUT
      const isTabVisible = !document.hidden

      if (isActive && isTabVisible) {
        checkVersion()
      }
    }, POLL_INTERVAL)

    // Also check immediately on tab focus (user coming back to the tab)
    const onVisibilityChange = () => {
      if (!document.hidden) {
        markActive()
        checkVersion()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Initial check — only if tab is visible
    if (!document.hidden) {
      checkVersion()
    }

    return () => {
      activityEvents.forEach((event) => {
        document.removeEventListener(event, markActive)
      })
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(interval)
    }
  }, [checkVersion])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleDismiss = () => {
    setVisible(false)
    // After animation out, hide the element and remember dismissed version
    setTimeout(() => {
      setUpdateAvailable(false)
      dismissedBuildRef.current = newBuildIdRef.current
    }, 300)
  }

  if (!updateAvailable) return null

  return (
    <Toast
      visible={visible}
      icon={<RefreshCw />}
      message="New version available"
      action={
        <Button onClick={handleRefresh} size="sm">
          Refresh
        </Button>
      }
      onDismiss={handleDismiss}
      dismissLabel="Dismiss update notification"
    />
  )
}
