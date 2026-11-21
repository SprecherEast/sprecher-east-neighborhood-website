import type { BillShareBlock } from '@/payload-types'
import type { AlertTone } from '@/platform/ui/Alert'

import { DEFAULT_BILL_TOASTS } from './billShareDefaults'
import { BILL_SHARE_LIMITS } from './editorialLimits'

/** The toasts the whole-bill block can show: the code asks for one by its id (#1379) */
export const BILL_TOAST_IDS = ['ratesCarried', 'ratesOwn'] as const
export type BillToastId = (typeof BILL_TOAST_IDS)[number]

export const BILL_TOAST_LABELS: Record<BillToastId, string> = {
  ratesCarried: 'Rates from an earlier year are in use',
  ratesOwn: 'Every rate is the year’s own',
}

export const BILL_TOAST_TONES = [
  'info',
  'success',
  'warning',
  'error',
] as const satisfies readonly AlertTone[]
export const BILL_TOAST_ENDINGS = ['fade', 'close', 'accept'] as const
/** Where a toast sits: directly above its panel, over the panel's top edge, or at the bottom of the screen */
export const BILL_TOAST_PLACEMENTS = ['above', 'panel', 'screen'] as const

/** One toast as the editor wrote it: its wording and how it ends */
export type BillToastDefinition = {
  tone: AlertTone
  /** A short heading above the message; empty for none */
  title: string
  /** What it says, with `{year}` blanks; empty turns the toast off */
  message: string
  ending: (typeof BILL_TOAST_ENDINGS)[number]
  placement: (typeof BILL_TOAST_PLACEMENTS)[number]
  /** How long a fading toast stays, in seconds */
  fadeSeconds: number
  /** How many times a reader sees it in one visit; after that the year switch is quiet */
  showsPerVisit: number
  /** What the accept button says */
  acceptLabel: string
}

/** One toast as the page shows it: the editor's definition, its time in milliseconds */
export type BillToast = Omit<BillToastDefinition, 'fadeSeconds'> & { durationMs: number }

/** One stored toast row, read loosely: a stored block may hold a value Admin would refuse */
type StoredToastRow = {
  toast?: string | null
  tone?: string | null
  title?: string | null
  message?: string | null
  ending?: string | null
  placement?: string | null
  fadeSeconds?: number | null
  showsPerVisit?: number | null
  acceptLabel?: string | null
}

/** The toasts as stored on the block (its rows are a `StoredToastRow`) */
export type StoredBillToasts = BillShareBlock['toasts'] | readonly StoredToastRow[]

const isIn = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.includes(value as T)

const heldTo = (seconds: unknown, fallback: number): number =>
  typeof seconds === 'number' && Number.isFinite(seconds)
    ? Math.min(
        Math.max(Math.round(seconds), BILL_SHARE_LIMITS.toastMinSeconds),
        BILL_SHARE_LIMITS.toastMaxSeconds,
      )
    : fallback

const countHeldTo = (count: unknown, fallback: number): number =>
  typeof count === 'number' && Number.isFinite(count)
    ? Math.min(
        Math.max(Math.round(count), BILL_SHARE_LIMITS.toastMinShows),
        BILL_SHARE_LIMITS.toastMaxShows,
      )
    : fallback

/**
 * The toasts the page can ask for, by id: each is the editor's row, or its starting definition while
 * the block has no list of its own (one stored before the toasts became fields). A toast with no
 * message, or no row in a list the editor kept, is off (null). A row's kind, ending, time or button
 * label that a stored block should not hold falls back to a sensible one, so a toast never breaks
 * the bill. A block that never saved a list but holds the note the rates panel had before the
 * toasts (`legacyNote`) says that note in the carried-rates toast, and an emptied note turns it off.
 */
export function toastsOf(
  stored: StoredBillToasts,
  legacyNote?: unknown,
): Record<BillToastId, BillToast | null> {
  const starting = BILL_TOAST_IDS.map((toast) => ({
    toast,
    ...DEFAULT_BILL_TOASTS[toast],
    ...(toast === 'ratesCarried' && typeof legacyNote === 'string' ? { message: legacyNote } : {}),
  }))
  const rows: readonly StoredToastRow[] = Array.isArray(stored) ? stored : starting
  const toasts = {} as Record<BillToastId, BillToast | null>
  for (const id of BILL_TOAST_IDS) {
    const row = rows.find((candidate) => candidate.toast === id)
    const fallback = DEFAULT_BILL_TOASTS[id]
    const message = row?.message?.trim()
    toasts[id] =
      row && message
        ? {
            tone: isIn(BILL_TOAST_TONES, row.tone) ? row.tone : 'info',
            title: row.title?.trim() ?? '',
            message,
            ending: isIn(BILL_TOAST_ENDINGS, row.ending) ? row.ending : 'accept',
            placement: isIn(BILL_TOAST_PLACEMENTS, row.placement) ? row.placement : 'above',
            durationMs: heldTo(row.fadeSeconds, fallback.fadeSeconds) * 1000,
            showsPerVisit: countHeldTo(row.showsPerVisit, fallback.showsPerVisit),
            acceptLabel: row.acceptLabel?.trim() || fallback.acceptLabel,
          }
        : null
  }
  return toasts
}
