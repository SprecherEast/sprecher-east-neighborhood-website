import { pointPlace } from './boundary.mjs'
import { streetAddresses } from './geocode.mjs'
import { clip } from './text.mjs'

// Placement (#1009; coverage.md, "Review passes", check 2): where an item is, by the City's
// boundary when its street address resolves to one point, otherwise by the area's words as verify
// judged them. It runs in code after verify and adds `verification.placement`, which says which
// method placed the item. It never reads or changes `safety` (gate.mjs), so a safety item stays
// held wherever it is. Anything that goes wrong falls back to the word match; nothing here throws.

const MADISON = /^(?:city of )?madison(?:,?\s*(?:wi|wis\.?|wisconsin))?(?:,?\s*\d{5}(?:-\d{4})?)?$/i
const NOT_PLACED_FLAGS = ['similar-name', 'prompt-injection']
const MAX_FAILURES_IN_A_ROW = 2
const REASONS = {
  none: 'the locator found no match for the address',
  unsure: 'the locator’s best match was not sure enough',
  ambiguous: 'the locator found the address in more than one place',
}
const filled = (text) => typeof text === 'string' && text.trim().length > 0

/**
 * A placer for one run: `async (verification, candidate) => verification` with `placement` set.
 * `boundary` is the loaded copy (or null), `record` area.yaml's `boundary`, `geocode` a function
 * from a street address to a result (geocode.mjs, or null), `onProblem` hears of a failing locator once.
 */
export function createPlacer({ boundary, record, geocode, onProblem = () => {} }) {
  const limit = record?.geocoder?.maxPerRun ?? 0
  const requestMs = (record?.geocoder?.timeoutSeconds ?? 0) * 1000
  const answers = new Map()
  let asked = 0
  let failures = 0
  let told = false

  /** The point for `street`, or why there is none. */
  async function resolve(street, deadline) {
    const key = street.toLowerCase()
    if (answers.has(key)) return answers.get(key)
    if (deadline !== undefined && Date.now() + requestMs > deadline)
      return { reason: 'the run is out of time for another locator request' }
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
        // Nothing from the failure is logged: it could hold the address that was asked for
        onProblem("The City's locator failed; items are placed by word match.")
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
  async function locate(verification, candidate, deadline) {
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
    return resolve(found[0], deadline)
  }

  async function placeVerified(given, candidate, deadline) {
    // Every answer below ends with this code's own `placement`, so one the model wrote is replaced
    const verification = given
    const found = await locate(verification, candidate, deadline)
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
    // catchment, citywide or outside it is stays verify's judgment. Verify's catchment for an
    // address inside is raised to core, and so is its unknown when verify confirmed the address;
    // placement never makes an item easier to accept than verify allowed, so any other
    // disagreement goes to a person.
    if (inside === (verification.coverage === 'core')) return { ...verification, placement }
    const coverage = inside ? 'core' : 'unknown'
    const said = verification.coverage
    // Only an address inside reaches here with another tier than core, so this is never true outside
    const raised =
      said === 'catchment' || (said === 'unknown' && verification.location.verified === true)
    return {
      ...verification,
      coverage,
      coverageReason: clip(
        `The City’s boundary puts the address ${inside ? 'inside' : 'outside'} the area, so it is ${inside ? '' : 'not '}core (verify said ${said}). ${verification.coverageReason}`,
        500,
      ),
      flags:
        raised || verification.flags.includes('ambiguous-location')
          ? verification.flags
          : [...verification.flags, 'ambiguous-location'],
      placement: { ...placement, overrode: true },
    }
  }

  return async function place(given, candidate, { deadline } = {}) {
    try {
      return await placeVerified(given, candidate, deadline)
    } catch {
      // A bug or an odd answer must not lose the item: it keeps verify's own placement
      // A fixed line: an error's message could quote the address
      onProblem('Placing an item failed; it is placed by word match.')
      return {
        ...given,
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
