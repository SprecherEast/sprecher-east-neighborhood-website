import { BILL_BODIES, type MillRates } from '@/platform/lib/billShare'

/**
 * Rates part of the way from one year's to another's (#1087): each body's rate moves in a straight
 * line, so a bill worked out from them moves smoothly from one year's amounts to the other's. A
 * body with a rate in only one of the two has no line to move along, so the new rates are used
 * whole.
 */
export function blendRates(from: MillRates, to: MillRates, amount: number): MillRates {
  const blended: MillRates = {}
  for (const key of BILL_BODIES) {
    const a = from[key]
    const b = to[key]
    if (typeof a !== 'number' || typeof b !== 'number') return to
    blended[key] = a + (b - a) * amount
  }
  return blended
}

/**
 * The rates at a position among the years: a whole number is that year's own rates, and between
 * two it is a blend of the neighbours. A position past either end is that end's rates.
 */
export function ratesAtPosition(years: readonly MillRates[], position: number): MillRates {
  const last = years.length - 1
  const at = Math.min(Math.max(position, 0), last)
  const low = Math.floor(at)
  const high = Math.ceil(at)
  const lowRates = years[low]
  const highRates = years[high]
  if (!lowRates || !highRates) return {}
  return low === high ? lowRates : blendRates(lowRates, highRates, at - low)
}
