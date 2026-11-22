'use client'

import { useRef, useState } from 'react'

import type { ToastCloseReason } from '@/platform/ui/Toast.client'

import type { BillShareYear } from './billShare'
import { toastFor, yearToastFor } from './billRates'
import {
  BILL_TOAST_PLACES,
  type BillToast,
  type BillToastId,
  type BillToastPlace,
} from './billToasts'

/** A toast on show: a new `key` for each showing, so one not yet accepted is replaced by the next */
type OnShow = { key: number; open: boolean; id: BillToastId }

/** What a panel draws for the toast on show: the editor's toast and its words, with the blanks filled */
export type ShownToast = { key: number; open: boolean; toast: BillToast; message: string }

/**
 * Which toast is on show over which panel (#1417). A toast opens only when the reader presses a
 * panel's Estimate button (`tell`), as often as they press it: nothing opens by itself, on load, on
 * scrolling, on an estimate or on a year switch. Only one toast is on show at a time, over its own
 * panel. A toast is for the year it was opened in, so `shownFor` gives nothing once the year has
 * moved on.
 */
export function useBillToasts(
  years: readonly BillShareYear[],
  yearIndex: number,
  toasts: Record<BillToastId, BillToast | null>,
) {
  const [onShow, setOnShow] = useState<OnShow | null>(null)
  // The button the reader pressed to open a toast, so focus can go back to it when they close it
  const opener = useRef<HTMLElement | null>(null)
  const open = (id: BillToastId) =>
    setOnShow((previous) => ({ key: (previous?.key ?? 0) + 1, open: true, id }))

  /** The toast a press on a panel's Estimate button opens: the rates panel's is the year's own warning, else its general one */
  const idFor = (place: BillToastPlace): BillToastId =>
    place === 'rates'
      ? (yearToastFor(years, yearIndex, toasts)?.id ?? 'aboutRates')
      : place === 'answer'
        ? 'aboutAnswer'
        : 'aboutBill'

  /** Whether a press on a panel's Estimate button has something to say; the editor may have emptied it */
  const canTell = (place: BillToastPlace): boolean =>
    toastFor(idFor(place), years, yearIndex, toasts) !== null

  const tell = (place: BillToastPlace) => {
    if (!canTell(place)) return
    const pressed = document.activeElement
    opener.current = pressed instanceof HTMLElement && pressed !== document.body ? pressed : null
    open(idFor(place))
  }

  const shownFor = (place: BillToastPlace): ShownToast | null => {
    if (!onShow || BILL_TOAST_PLACES[onShow.id] !== place) return null
    // The year's own rates warning is the year it was shown in; a switch leaves it behind
    const isYearToast = onShow.id === 'ratesCarried' || onShow.id === 'ratesOwn'
    if (isYearToast && yearToastFor(years, yearIndex, toasts)?.id !== onShow.id) return null
    const found = toastFor(onShow.id, years, yearIndex, toasts)
    return found
      ? { key: onShow.key, open: onShow.open, toast: found.toast, message: found.message }
      : null
  }

  return {
    tell,
    canTell,
    shownFor,
    /** It slides out, then is gone; when the reader closed it, focus goes back to the button that opened it */
    dismiss: (reason: ToastCloseReason) => {
      setOnShow((previous) => previous && { ...previous, open: false })
      if (reason !== 'fade') opener.current?.focus()
      opener.current = null
    },
    /** The year changed: a toast about the year it was opened in goes */
    clear: () => setOnShow(null),
  }
}
