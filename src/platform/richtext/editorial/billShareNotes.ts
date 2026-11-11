import { fillFromEarlier } from '@/platform/lib/billShare'

import type { BillShareYear } from './billShare'

/** "A, B and C" */
export const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

/** The note that is always there: how rough the answer is, and why a real bill differs */
export const ROUGH_NOTE =
  'A rough estimate. Credits, exemptions and who owns the home change your real bill.'

/**
 * The note for a year in which a body has not set its rate, so the estimate borrows the year
 * before's. It says the City's rate for the year is proposed, not confirmed (the article is about
 * the City's tax), and never which other bodies' rates were borrowed; null for a year with nothing
 * borrowed.
 */
export function unconfirmedNote(years: readonly BillShareYear[], index: number): string | null {
  const year = years[index]
  const earlier = years[index - 1]
  if (!year || !earlier) return null
  const { filled } = fillFromEarlier(year.rates, earlier.rates)
  return filled.length === 0 ? null : `The City’s ${year.year} tax rate is proposed, not confirmed.`
}

/** The note that takes the room kept for it in every year: the first year's that has one */
export function reservedNote(years: readonly BillShareYear[]): string | null {
  for (let index = 0; index < years.length; index++) {
    const note = unconfirmedNote(years, index)
    if (note) return note
  }
  return null
}
