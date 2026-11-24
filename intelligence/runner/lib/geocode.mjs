import { fetchDirect } from './fetchSource.mjs'

// From an item's text to a point on the map (#1009). The only geocoder is the City of Madison's
// own address locator: official, free, no key. Only a street address (a house number, a street
// and its type) is ever sent, read from the text of a public item; never a name, a title or
// anything else. The request is bounded by a timeout, a size limit and a count per run.

const TYPES =
  'St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Cir|Circle|Ter|Terrace|Trl|Trail|Hwy|Highway|Loop|Pass|Run|Sq|Square'
const WORD = "[A-Za-z][A-Za-z.'-]*"
// number, an optional direction, up to three name words, then the street type; "7 PM on Main St" is not an address
const ADDRESS = new RegExp(
  `\\b\\d{1,6}(?!\\s*[ap]\\.?m\\b)\\s+(?:(?:[NSEW]|North|South|East|West)\\.?\\s+)?(?:${WORD}\\s+){0,2}?${WORD}\\s+(?:${TYPES})\\b`,
  'gi',
)
/** The only shape sent to the locator: single spaces, a number, then words. */
const PLAIN_STREET = /^\d{1,6}(?: [A-Za-z][A-Za-z.'-]*){2,6}$/
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
  const text = String(error ?? '')
  if (status === 'blocked') return 'the locator refused or sent us to a login'
  if (/^\d{3}\b/.test(text)) return `the locator answered HTTP ${text.slice(0, 3)}`
  if (/^no answer|^body not received/.test(text)) return 'the locator did not answer in time'
  if (/^body over/.test(text)) return 'the locator’s answer was too large'
  return 'the locator’s answer was refused'
}

/** The candidates of a locator answer: `[{ score, point }]`, or throws when it isn't the shape. */
function candidatesOf(body) {
  const answer = JSON.parse(body)
  if (answer?.error) throw new Error('the locator answered with an error')
  return answer.candidates.map((c) => {
    const point = [c?.location?.x, c?.location?.y]
    if (!Number.isFinite(c?.score) || !point.every(Number.isFinite) || !inRange(point))
      throw new Error('a candidate has no usable score or point')
    return { score: c.score, point }
  })
}

/**
 * A geocoder over the City's locator: `async (street) => result`, `result` being
 * `{ status: 'match', point: [lon, lat] }`, `{ status: 'none' }` (nothing found), `{ status:
 * 'unsure' }` (nothing scores `minScore`), `{ status: 'ambiguous' }` (strong matches in different
 * places) or `{ status: 'failed', error }`. It never throws.
 */
export function cityGeocoder({ http = fetch, config }) {
  return async (street) => {
    if (typeof street !== 'string' || !PLAIN_STREET.test(street) || street.length > 80)
      return { status: 'failed', error: 'not a plain street address' }
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
      // One request per address, to the City's host only: the street goes nowhere else
      retry: false,
      sameOrigin: true,
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
