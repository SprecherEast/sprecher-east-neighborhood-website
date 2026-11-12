import type { ResolvedLink } from '@/platform/lib'
import { fillFromEarlier } from '@/platform/lib/billShare'

import type { BillShareYear } from './billShare'

/** "A, B and C" */
export const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

/** The note that is always there: how rough the answer is, and why a real bill differs */
export const ROUGH_NOTE =
  'A rough estimate. Credits, exemptions and who owns the home change your real bill.'

/**
 * The note that says how an earlier year's home is priced (#1121): the value a reader types is the
 * latest year's, and an earlier year's is assumed to have changed as the average home did. Null
 * with one year, which has no earlier value to assume.
 */
export function assumedNote(years: readonly BillShareYear[]): string | null {
  if (years.length < 2) return null
  const earlier = years.slice(0, -1).map((year) => year.year)
  return `Your home’s ${joinNames(earlier.map(String))} value is assumed to have changed as the average home’s did.`
}

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

/** The sources a tab lists, each once: the same link given twice (the tab's and a year's) shows once */
export function uniqueSources(
  sources: readonly (ResolvedLink | null | undefined)[],
): ResolvedLink[] {
  const seen = new Set<string>()
  return sources.flatMap((source) => {
    if (!source || seen.has(source.href)) return []
    seen.add(source.href)
    return [source]
  })
}
