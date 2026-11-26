import { parseFeed } from './feed.mjs'
import { hasStreetType } from './geocode.mjs'

// The City's police incident reports feed (#993). Its descriptions begin with the place, then a
// comma, then the text: a block ("2800 block Curry Pkwy"), an intersection ("Mineral Point Rd. at
// S. Gammon Rd.") or a bare street; an update has none, because its description is replaced by
// "UPDATE:" and the text. Two things are read from that layout, and nothing about what an item
// means: the leading place, and the report's own page as the item's identity (the feed's guid ends
// in the time of the last update, so it would make every update look like a new report). Whether
// an item is a safety item, and where it is, is decided elsewhere (safety.yaml, place.mjs).

/** Up to the first comma, with any space before it left out, at the very start of the description. */
const LEADING = /^([^,]{1,60}?)\s*,/
/** What a leading place is made of: letters, digits, spaces and a few marks of street names. */
const PLACE_SHAPE = /^[A-Za-z0-9.'&/ ]+$/
const MAX_WORDS = 8

/**
 * The place a description begins with, or null (`description` is already collapsed, as a
 * candidate's `sourceText` is). It is taken only from the start, only when it is short, made of
 * street characters and holds a street type, so an update's prefix ("UPDATE: ...") is never one.
 * The limit: a short lead sentence with a street before its first comma is read as one. It is a
 * hint for verify, which reads the whole report; the boundary places a block.
 */
export function leadingPlace(description) {
  const first = LEADING.exec(description)?.[1]
  if (!first || !PLACE_SHAPE.test(first) || first.split(' ').length > MAX_WORDS) return null
  return hasStreetType(first) ? first : null
}

/** Police incident reports (RSS 2.0): news items with the leading place and the report's page as id. */
export function parseIncidentReports(body) {
  return parseFeed(body).flatMap((item) => {
    // No page of its own: it can't be told apart from another report, so it is not taken
    if (typeof item.url !== 'string' || !item.url.startsWith('https://')) return []
    return [{ ...item, ownId: item.url, locationText: leadingPlace(item.sourceText) }]
  })
}
