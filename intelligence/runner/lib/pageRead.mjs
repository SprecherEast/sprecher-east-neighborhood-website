import { fetchDirect } from './fetchSource.mjs'

// The runner's own read of a report page (#993). Whether an always-held source's report page was
// read is a fact the code knows, not something verify writes: the runner fetches the item's own
// page once, with robots.txt honored, and the gate (gate.mjs) holds any `reject` of such an item
// unless that read succeeded. The page is only fetched, never given to a model, and only from the
// source's own https host, so an address in a feed can't send the runner anywhere else.

const TIMEOUT_MS = 10_000
const MAX_BYTES = 1024 * 1024

/** The host of an https URL without a leading `www.`, or null. */
function httpsHost(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

/**
 * Whether the candidate's own page was read: one request with no retry and no redirect, through
 * `robots`, to the source's own host. Never throws; anything else is not a read.
 */
export async function readReportPage(candidate, { source, http, robots }) {
  try {
    const own = httpsHost(source?.canonicalUrl)
    if (own === null || own !== httpsHost(candidate?.sourceUrl)) return false
    const answer = await fetchDirect(candidate.sourceUrl, {
      http,
      robots,
      retry: false,
      maxHops: 0,
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    })
    return answer.status === 'ok' && typeof answer.body === 'string' && answer.body.trim() !== ''
  } catch {
    return false
  }
}

/**
 * Records the read on the item without making it part of the item: not listed, not in its JSON,
 * so no model sees it and no schema has to know it. A copy of the item (`{ ...item }`) drops it,
 * so the gate reads it from the item it is given.
 */
export function markPageRead(item, read) {
  Object.defineProperty(item, 'pageRead', {
    value: read === true,
    enumerable: false,
    configurable: true,
  })
}

export const pageWasRead = (item) => item?.pageRead === true

/** Every source id an item came from: its own, and the sources that also reported it. */
const sourceIds = (candidate) => [
  candidate.sourceId,
  ...(candidate.alsoReportedBy ?? []).map((other) => other?.sourceId),
]

/**
 * Whether `item` is a reject the gate must hold: it came from an always-held source (alone or
 * with others) and the runner did not read its page. A definition or item it can't read counts as
 * held, because a gate that can't tell must not let a report go.
 */
export function rejectUnread(rules, item) {
  try {
    return sourceIds(item.candidate).some((id) => rules.sources.has(id)) && !pageWasRead(item)
  } catch {
    return true
  }
}
