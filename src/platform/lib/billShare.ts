import { toUnitCounts } from './chart/unitCells'

/**
 * Who a property-tax bill is paid to, in the order the bill bar draws them: the schools' big slice,
 * then the City's, which the panel under the bar belongs to, then the smaller two.
 */
export const BILL_BODIES = ['schools', 'city', 'county', 'matc'] as const
export type BillBody = (typeof BILL_BODIES)[number]

/** What the bodies are called on the page and in the editor */
export const BILL_BODY_NAMES: Record<BillBody, string> = {
  schools: 'Madison schools',
  city: 'City of Madison',
  county: 'Dane County',
  matc: 'Madison College (MATC)',
}

/** Each body's tax rate in dollars per $1,000 of assessed value (its "mill rate"); a body that has not set one is left out */
export type MillRates = Partial<Record<BillBody, number>>

/** One body's part of the bill; `null` where its rate is not set */
export type BillPart = {
  key: BillBody
  amount: number | null
  /** Its exact share of the whole bill, 0 to 100, for the bar's widths */
  share: number | null
  /** Its share as a whole number; the four add up to exactly 100 */
  percent: number | null
}

export type BillShare = {
  parts: BillPart[]
  /** Every body has set its rate, so the whole bill and the shares are known */
  complete: boolean
  total: number | null
  /** The bodies whose rate is not set */
  missing: BillBody[]
}

/** The largest home value the box accepts, so a typo cannot print a nonsense bill */
const MAX_HOME_VALUE = 100_000_000

/**
 * A home value typed into the box, as whole dollars: digits with optional "$", commas and
 * spaces. Anything else (letters, a minus, zero, an absurd size) is null, so the box shows no bill
 * rather than a wrong one.
 */
export function parseHomeValue(text: string): number | null {
  const cleaned = text.replace(/[\s$,]/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const value = Math.round(Number(cleaned))
  return value > 0 && value <= MAX_HOME_VALUE ? value : null
}

const rateOf = (rates: MillRates, key: BillBody) => {
  const rate = rates[key]
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null
}

/**
 * What a home is taxed by each body: value times rate per $1,000. The shares and the total exist
 * only when all four bodies have set a rate; otherwise only the amounts that are known are given,
 * so a year with just the City's proposal is never shown as a whole bill.
 */
export function computeBillShare(homeValue: number, rates: MillRates): BillShare {
  const amounts = BILL_BODIES.map((key) => {
    const rate = rateOf(rates, key)
    return rate === null ? null : (homeValue / 1000) * rate
  })
  const missing = BILL_BODIES.filter((_, index) => amounts[index] === null)
  if (missing.length > 0) {
    return {
      parts: BILL_BODIES.map((key, index) => ({
        key,
        amount: amounts[index],
        share: null,
        percent: null,
      })),
      complete: false,
      total: null,
      missing,
    }
  }
  const known = amounts as number[]
  const total = known.reduce((sum, amount) => sum + amount, 0)
  const percents = toUnitCounts(
    BILL_BODIES.map((key, index) => ({ key, value: known[index] })),
    100,
  )
  return {
    parts: BILL_BODIES.map((key, index) => ({
      key,
      amount: known[index],
      share: (known[index] / total) * 100,
      percent: percents[index],
    })),
    complete: true,
    total,
    missing: [],
  }
}

/**
 * A year's rates with each one it has not set taken from an earlier year, and which those are: a
 * bill for a year in which only the City has proposed is still an estimate, built from last year's
 * rates for the rest, and the page says so.
 */
export function fillFromEarlier(
  rates: MillRates,
  earlier: MillRates | undefined,
): { rates: MillRates; filled: BillBody[] } {
  const filled = BILL_BODIES.filter(
    (key) => rateOf(rates, key) === null && earlier && rateOf(earlier, key) !== null,
  )
  const merged: MillRates = { ...rates }
  for (const key of filled) merged[key] = earlier?.[key]
  return { rates: merged, filled }
}
