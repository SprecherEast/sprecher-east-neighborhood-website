import { BILL_BODY_NAMES, fillFromEarlier } from '@/platform/lib/billShare'

import type { BillShareYear } from './billShare'

/** "A, B and C" */
export const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

/** The note that is always there: how rough the answer is, and why a real bill differs */
export const ROUGH_NOTE =
  'This is a rough estimate. Credits, exemptions and who owns the home (a church, say) change every bill, so yours won’t match.'

/**
 * The note for a year in which a body has not set its rate, so the estimate borrows the year
 * before's; null for a year with nothing borrowed.
 */
export function unconfirmedNote(years: readonly BillShareYear[], index: number): string | null {
  const year = years[index]
  const earlier = years[index - 1]
  if (!year || !earlier) return null
  const { filled } = fillFromEarlier(year.rates, earlier.rates)
  if (filled.length === 0) return null
  const names = joinNames(filled.map((key) => BILL_BODY_NAMES[key]))
  return `${year.year} rates are not confirmed: ${names} ${filled.length === 1 ? 'has' : 'have'} not set ${filled.length === 1 ? 'its' : 'theirs'} yet, so this uses ${earlier.year}’s.`
}

/** The note that takes the room kept for it in every year: the first year's that has one */
export function reservedNote(years: readonly BillShareYear[]): string | null {
  for (let index = 0; index < years.length; index++) {
    const note = unconfirmedNote(years, index)
    if (note) return note
  }
  return null
}
