import { fetchDirect } from './fetchSource.mjs'

// From an item's text to a point on the map (#1009). The only geocoder is the City of Madison's
// own address locator: official, free, no key. Only a street address (a house number, a street
// and its type) is ever sent, read from the text of a public item; never a name, a title or
// anything else. The request is bounded by a timeout, a size limit (the count per run is kept in place.mjs).

const TYPES =
  'St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Cir|Circle|Ter|Terrace|Trl|Trail|Hwy|Highway|Loop|Pass|Run|Sq|Square'
const WORD = "[A-Za-z][A-Za-z.'-]*"
// A hundred block ("2800 block of Curry Pkwy", as police reports give it) or a house number, then
// an optional direction, up to three name words, then the street type; "7 PM on Main St" is not an
// address. The rule is about layout, never a list of spellings: a house number is never followed
// directly by a connector word (at, and, near, by, to, from, between) or by "block" or "blocks",
// and never comes just after a slash or a dash. (A symbol after the number can't begin a street
// name, so it needs no rule of its own.) That keeps an intersection ("Hwy 51 at ...", "US 12 & 18
// at ...", "I-94 at ..."), an exit and "within 2 blocks of Main St" from being sent, in any
// spelling of those, and "Acme Co. 123 Main St" is still found.
// The limit, stated plainly: other prose after a number ("Hwy 51 north of ...", "Hwy 30 W Sprecher
// Rd", "2 miles from ...") can still be read as an address. It is public text from the item, never
// resident data, and the City's locator finds nothing for it. A unit written "Unit 4-123 Main St"
// or "Apt 2/123 Main St" is not found (the safe side; "123 Main St #4" is).
// Only a hundred of three to six digits makes a block. A street named "Block" with a hundred before
// it ("100 Block Island Rd") is read as a block: the placement then carries a flag, so a person looks.
const HUNDRED = String.raw`[1-9]\d{0,3}00`
const DASHES = String.raw`\-\u2010-\u2015\u2212`
const CONNECTOR = String.raw`(?:at|and|near|by|to|from|between|blocks?)\b`
const HUNDRED_BLOCK = String.raw`${HUNDRED}\s+block\s+(?:of\s+)?`
const HOUSE_NUMBER = String.raw`(?<![/${DASHES}])\d{1,6}(?!\s*[ap]\.?m\b)\s+(?!${CONNECTOR})`
const ADDRESS = new RegExp(
  `\\b(?:${HUNDRED_BLOCK}|${HOUSE_NUMBER})(?:(?:[NSEW]|North|South|East|West)\\.?\\s+)?(?:${WORD}\\s+){0,2}?${WORD}\\s+(?:${TYPES})\\b`,
  'gi',
)
const BLOCK = new RegExp(`^(${HUNDRED}) block (?:of )?`, 'i')
/** Whether `text` has a street type, plural too, as a whole word: street data, not a word list about meaning. */
export const hasStreetType = (text) => new RegExp(`\\b(?:${TYPES})s?\\b`, 'i').test(text)
/** The only shape sent to the locator: single spaces, a number, then words. */
const PLAIN_STREET = /^\d{1,6}(?: [A-Za-z][A-Za-z.'-]*){2,6}$/
/** Whether `street` is a short plain street address, the one thing the locator is ever sent. */
export const isPlainStreet = (street) =>
  typeof street === 'string' && PLAIN_STREET.test(street) && street.length <= 80

/**
 * What the locator is asked for `street`: for a block ("2800 block of Curry Pkwy") the first
 * address of the block, "2800 Curry Pkwy", the only public house number the text gives.
 * `block` says the point stands for a block, not one building (coverage.md, check 2).
 */
export function locatorQuery(street) {
  const block = BLOCK.test(street)
  return { query: block ? street.replace(BLOCK, '$1 ') : street, block }
}
const METERS_PER_DEGREE = 110_574

/** The distinct street addresses in `text`, in order, each as written with single spaces. */
export function streetAddresses(text) {
  if (typeof text !== 'string') return []
  const seen = new Map()
  for (const [found] of text.matchAll(ADDRESS)) {
    const street = found.replace(/\s+/g, ' ')
    if (!seen.has(street.toLowerCase())) seen.set(street.toLowerCase(), street)
  }
  return [...seen.values()]
}

const inRange = ([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90

/** Meters between two points, close enough for points a few blocks apart. */
const metersBetween = ([ax, ay], [bx, by]) =>
  Math.hypot((ax - bx) * Math.cos((ay * Math.PI) / 180), ay - by) * METERS_PER_DEGREE

/** Why a request failed, in fixed phrases: never the URL, which holds the street address. */
function failureOf({ status, error }) {
  const text = String(error)
  if (status === 'blocked') return 'the locator refused or sent us to a login'
  if (/^\d{3}$/.test(text)) return `the locator answered HTTP ${text}`
  if (/^no answer|^body not received/.test(text)) return 'the locator could not be reached'
  if (/^body over/.test(text)) return 'the locator’s answer was too large'
  return 'the locator’s answer was refused'
}

/** The candidates of a locator answer: `[{ score, point }]`, or throws when it isn't the shape. */
function candidatesOf(body) {
  const answer = JSON.parse(body)
  if (answer.error) throw new Error()
  return answer.candidates.map((c) => {
    const point = [c.location.x, c.location.y]
    if (!Number.isFinite(c.score) || !point.every(Number.isFinite) || !inRange(point))
      throw new Error()
    return { score: c.score, point }
  })
}

/**
 * A geocoder over the City's locator: `async (street) => result`, `result` being
 * `{ status: 'match', point: [lon, lat] }`, `{ status: 'none' }` (nothing found), `{ status:
 * 'unsure' }` (nothing scores `minScore`), `{ status: 'ambiguous' }` (strong matches in different
 * places) or `{ status: 'failed', error }`. A redirect answer with a `Location` that is not a URL
 * makes it throw after that one GET, and the placer treats a throw as a failure.
 */
export function cityGeocoder({ http, config }) {
  return async (street) => {
    if (!isPlainStreet(street)) return { status: 'failed', error: 'not a plain street address' }
    const query = new URLSearchParams([
      ['SingleLine', street],
      ['outSR', '4326'],
      ['maxLocations', '5'],
      ['f', 'json'],
    ])
    const answer = await fetchDirect(`${config.source}/findAddressCandidates?${query}`, {
      http,
      timeoutMs: config.timeoutSeconds * 1000,
      maxBytes: config.maxKilobytes * 1024,
      // One request per address and no redirect followed: the street goes only to the City's host
      retry: false,
      maxHops: 0,
    })
    if (answer.status !== 'ok') return { status: 'failed', error: failureOf(answer) }
    try {
      const candidates = candidatesOf(answer.body)
      if (candidates.length === 0) return { status: 'none' }
      const strong = candidates
        .filter((c) => c.score >= config.minScore)
        .sort((a, b) => b.score - a.score)
      if (strong.length === 0) return { status: 'unsure' }
      const [best, ...rest] = strong
      if (rest.some((c) => metersBetween(best.point, c.point) > config.sameSpotMeters))
        return { status: 'ambiguous' }
      return { status: 'match', point: best.point }
    } catch {
      // A fixed phrase: a parser's message can quote the answer, and an answer can echo the street
      return { status: 'failed', error: 'the locator’s answer can’t be read' }
    }
  }
}
