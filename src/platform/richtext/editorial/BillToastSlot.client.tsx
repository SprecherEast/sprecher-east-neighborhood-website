'use client'

import React from 'react'

import { Toast, type ToastCloseReason } from '@/platform/ui/Toast.client'

import type { ShownToast } from './useBillToasts.client'

/** The toast on show over a panel, drawn the way the editor set it, or nothing (#1380, #1417) */
export function BillToastSlot({
  shown,
  onDismiss,
}: {
  shown: ShownToast | null
  onDismiss: (reason: ToastCloseReason) => void
}) {
  if (!shown) return null
  const { toast } = shown
  return (
    <Toast
      key={shown.key}
      visible={shown.open}
      tone={toast.tone}
      title={toast.title || undefined}
      message={shown.message}
      ending={toast.ending}
      durationMs={toast.durationMs}
      acceptLabel={toast.acceptLabel}
      placement={toast.placement}
      onDismiss={onDismiss}
    />
  )
}
