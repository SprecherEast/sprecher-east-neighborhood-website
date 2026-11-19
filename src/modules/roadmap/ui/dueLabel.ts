import { formatDateShort } from '@/platform/lib/formatDateTime'

import { dueIn } from '../domain/stats'

const days = (n: number) => (n === 1 ? '1 day' : `${n} days`)

/** A milestone's due date in words: "Due Dec 1 · in 22 days", or `null` with no date */
export function dueLabel(dueOn: string | null, now: Date, closed: boolean): string | null {
  if (!dueOn) return null
  const date = formatDateShort(dueOn)
  const away = dueIn(dueOn, now)

  if (closed) return away >= 0 ? `Due ${date}` : `Was due ${date}`
  if (away === 0) return 'Due today'
  if (away === 1) return `Due ${date} · tomorrow`
  if (away > 1) return `Due ${date} · in ${days(away)}`
  if (away === -1) return `Was due ${date} · yesterday`
  return `Was due ${date} · ${days(-away)} ago`
}
