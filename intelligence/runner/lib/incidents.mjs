import { parseFeed } from './feed.mjs'
import { collapse } from './text.mjs'

// The City's police incident reports feed (#993). Its descriptions begin with the block address,
// then a comma, then the text; some items have none (an update, for one). Two things are read
// from the feed's layout, and nothing about what an item means: the place from that first part,
// and the report's own page as its identity. The feed's guid ends in the time of the last update,
// so it would make every update look like a new report; the page address does not change.
// Whether an item is a safety item, and where it is, is decided elsewhere (safety.yaml, place.mjs).

/** "2800 block Curry Pkwy" at the very start of the description, as the feed gives it. */
const BLOCK_ADDRESS = /^(\d{1,6} block (?:of )?[^,]{2,60}?)\s*,/i

/** The block address a description begins with, or null; never found in a title or later in the text. */
export function blockAddress(description) {
  const found = BLOCK_ADDRESS.exec(collapse(description))
  return found ? found[1] : null
}

/** The report's page address without the update stamp (the part after `#`). */
const pageOf = (url) =>
  typeof url === 'string' && url.startsWith('https://') ? url.split('#')[0] : null

/** Police incident reports (RSS 2.0): news items with the block address and a stable id. */
export function parseIncidentReports(body) {
  return parseFeed(body).flatMap((item) => {
    const page = pageOf(item.url)
    // No page of its own: it can't be told apart from another report, so it is not taken
    if (page === null) return []
    return [{ ...item, ownId: page, url: page, locationText: blockAddress(item.sourceText) }]
  })
}
