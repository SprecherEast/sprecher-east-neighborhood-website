import { fetchDirect } from './fetchSource.mjs'
import { toSourceText } from './text.mjs'

// The runner's own read of a report page (#993). The model stages have no tools, so the runner
// fetches the item's own page once, with robots.txt honored, and puts its text (markup removed,
// at most 8,000 characters, untrusted data like any source text) in the item verify is given, as
// `reportPage`. A page counts as read only when that text is in the item, so the gate (gate.mjs)
// holds any `reject` or `duplicate` of such an item that went to verify without it. Only the source's own https
// origin is fetched, so an address in a feed can't send the runner anywhere else.

const TIMEOUT_MS = 10_000
const MAX_BYTES = 1024 * 1024

/** The origin of an https URL without a leading `www.` (its port stays), or null. */
function httpsOrigin(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.host.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

/**
 * The candidate's own page as `{ url, text }`: one request with no retry and no redirect, through
 * `robots`, to the source's own origin, its text cleaned and bounded. Never throws; anything else
 * (an error, an empty page, a page over the size bound) is `null`, not a read.
 */
export async function readReportPage(candidate, { source, http, robots }) {
  try {
    const own = httpsOrigin(source?.canonicalUrl)
    if (own === null || own !== httpsOrigin(candidate?.sourceUrl)) return null
    const answer = await fetchDirect(candidate.sourceUrl, {
      http,
      robots,
      retry: false,
      maxHops: 0,
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    })
    const text = answer.status === 'ok' ? toSourceText(answer.body) : ''
    return text === '' ? null : { url: candidate.sourceUrl, text }
  } catch {
    return null
  }
}

/** Whether the item carries the page text verify was given: the only thing a read means. */
export const pageWasRead = (item) =>
  typeof item?.reportPage?.text === 'string' && item.reportPage.text.trim() !== ''

/** Every source id an item came from: its own, and the sources that also reported it. */
const sourceIds = (candidate) => [
  candidate.sourceId,
  ...(candidate.alsoReportedBy ?? []).map((other) => other?.sourceId),
]

/**
 * Whether `item` is a report the gate must hold if curate would drop it (`reject` or
 * `duplicate`): it came from an always-held source (alone or with others) and the runner did not
 * read its page. A definition or item it can't read counts as held, because a gate that can't
 * tell must not let a report go.
 */
export function unreadReport(rules, item) {
  try {
    return sourceIds(item.candidate).some((id) => rules.sources.has(id)) && !pageWasRead(item)
  } catch {
    return true
  }
}
