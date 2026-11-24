import { pointPlace } from './boundary.mjs'
import { streetAddresses } from './geocode.mjs'
import { clip } from './text.mjs'

// Placement (#1009; coverage.md, "Review passes", check 2): where an item is, by the City's
// boundary when its street address resolves to one point, otherwise by the area's words as verify
// judged them. It runs in code after verify and adds `verification.placement`, which says which
// method placed the item. It never reads or changes `safety` (gate.mjs), so a safety item stays
// held wherever it is. Anything that goes wrong falls back to the word match; nothing here throws.

const MADISON = /^madison(?:,?\s*(?:wi|wis\.?|wisconsin))?$/i
const NOT_PLACED_FLAGS = ['similar-name', 'prompt-injection']
const MAX_FAILURES_IN_A_ROW = 2
/** The tiers that only lacked the boundary: for an address inside they become core without a hold. */
const RAISED_TO_CORE = new Set(['catchment', 'unknown'])
const REASONS = {
  none: 'the locator found no match for the address',
  unsure: 'the locator’s best match was not sure enough',
  ambiguous: 'the locator found the address in more than one place',
}
/** `verification` without any placement, which only this code may write. */
const withoutPlacement = (given) => {
  const verification = { ...given }
  delete verification.placement
  return verification
}
const filled = (text) => typeof text === 'string' && text.trim().length > 0

/**
 * A placer for one run: `async (verification, candidate) => verification` with `placement` set.
 * `boundary` is the loaded copy (or null), `record` area.yaml's `boundary`, `geocode` a function
 * from a street address to a result (geocode.mjs, or null), `onProblem` hears of a failing locator once.
 */
export function createPlacer({ boundary, record, geocode, onProblem = () => {} }) {
  const limit = record?.geocoder?.maxPerRun ?? 0
  const answers = new Map()
  let asked = 0
  let failures = 0
  let told = false

  /** The point for `street`, or why there is none. */
  async function resolve(street) {
    const key = street.toLowerCase()
    if (answers.has(key)) return answers.get(key)
    if (failures >= MAX_FAILURES_IN_A_ROW)
      return { reason: 'the locator failed earlier in this run' }
    if (asked >= limit)
      return { reason: `the run’s limit of ${limit} locator requests was reached` }
    asked++
    let result
    try {
      result = await geocode(street)
    } catch (error) {
      result = { status: 'failed', error: error.message }
    }
    if (result?.status === 'failed') {
      failures++
      if (!told) {
        told = true
        onProblem(
          `The City's locator failed (${clip(String(result.error), 150)}); items are placed by word match.`,
        )
      }
      return { reason: 'the locator failed' }
    }
    failures = 0
    const answer =
      result?.status === 'match'
        ? { point: result.point }
        : { reason: REASONS[result?.status] ?? 'the locator gave no usable answer' }
    answers.set(key, answer)
    return answer
  }

  /** The point for the item, or why it can't be placed by the boundary. */
  async function locate(verification, candidate) {
    if (!boundary) return { reason: 'no boundary is loaded' }
    if (record?.verified !== true) return { reason: 'the boundary record is not verified' }
    if (typeof geocode !== 'function') return { reason: 'no locator is configured' }
    const { municipality } = verification.location
    if (filled(municipality) && !MADISON.test(municipality.trim()))
      return { reason: 'the municipality is not Madison, Wisconsin' }
    if (NOT_PLACED_FLAGS.some((flag) => verification.flags.includes(flag)))
      return { reason: 'the item is flagged as a similar name or as an injection' }
    let found = streetAddresses(verification.location.address)
    if (found.length === 0) found = streetAddresses(candidate.locationText)
    if (found.length > 1) return { reason: 'more than one street address in the item' }
    if (found.length === 0) return { reason: 'no street address in the item' }
    return resolve(found[0])
  }

  async function placeVerified(given, candidate) {
    const verification = withoutPlacement(given)
    const found = await locate(verification, candidate)
    if (!found.point) {
      const text = [
        verification.location.name,
        verification.location.address,
        candidate.locationText,
      ]
      const method = text.some(filled) ? 'word-match' : 'unplaced'
      return {
        ...verification,
        placement: { method, inside: null, reason: found.reason, overrode: false },
      }
    }
    const inside = pointPlace(boundary, found.point) === 'inside'
    const placement = {
      method: 'boundary',
      inside,
      reason: `the address is ${inside ? 'inside' : 'outside'} the City’s boundary for the area`,
      overrode: false,
    }
    // The boundary is the authority on inside and outside, so a tier that can't hold is replaced:
    // inside is core, and core is never kept for an address outside. Outside, which of
    // catchment, citywide or outside it is stays verify's judgment. Verify's catchment or unknown
    // for an address inside only lacked the boundary, so it is raised to core; any other
    // disagreement goes to a person.
    if (inside === (verification.coverage === 'core')) return { ...verification, placement }
    const coverage = inside ? 'core' : 'unknown'
    const said = verification.coverage
    return {
      ...verification,
      coverage,
      coverageReason: clip(
        `The City’s boundary puts the address ${inside ? 'inside' : 'outside'} the area, so it is ${inside ? '' : 'not '}core (verify said ${said}). ${verification.coverageReason}`,
        500,
      ),
      flags:
        (inside && RAISED_TO_CORE.has(said)) || verification.flags.includes('ambiguous-location')
          ? verification.flags
          : [...verification.flags, 'ambiguous-location'],
      placement: { ...placement, overrode: true },
    }
  }

  return async function place(given, candidate) {
    try {
      return await placeVerified(given, candidate)
    } catch (error) {
      // A bug or an odd answer must not lose the item: it keeps verify's own placement
      onProblem(
        `Placing an item failed (${clip(String(error.message), 150)}); it is placed by word match.`,
      )
      return {
        ...withoutPlacement(given),
        placement: {
          method: 'word-match',
          inside: null,
          reason: 'placing the item failed',
          overrode: false,
        },
      }
    }
  }
}
