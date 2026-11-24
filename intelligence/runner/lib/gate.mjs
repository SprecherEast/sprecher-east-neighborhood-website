import { classifySafety } from './safety.mjs'
import { guardPromotion } from './stages.mjs'

// The one place that decides what may be accepted and which tool an item goes to. Submit calls it
// before anything is sent, so no stage, caller or setting can send a suggestion around it. An
// `accept` is let through only when verification is confident and unflagged (`promotionGuard`) and
// the item is not a safety item (safety.yaml). Everything unreadable is held.

const DECISIONS = ['accept', 'reject', 'needs-review', 'update', 'cancel', 'duplicate']
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const hold = (curation, reason) => ({
  ...curation,
  decision: 'needs-review',
  reasons: [reason, ...(Array.isArray(curation.reasons) ? curation.reasons : [])]
    .filter((text) => typeof text === 'string' && text.length > 0)
    .map((text) => text.slice(0, 300))
    .slice(0, 5),
})

/** The tool for `decision`; only a decision that survived the gate as `accept` may be a suggestion. */
function routeFor(pipeline, decision) {
  const wanted = pipeline?.routes?.[decision]
  if (decision === 'accept')
    return ['submitSuggestion', 'reportItem', 'none'].includes(wanted) ? wanted : 'reportItem'
  if (decision === 'reject' || decision === 'duplicate')
    return wanted === 'reportItem' ? 'reportItem' : 'none'
  return 'reportItem'
}

/**
 * `{ curation, route }` for `item`: the curation to act on, with an `accept` turned into
 * `needs-review` (and the reason added) when it may not be accepted, and the MCP tool to call.
 * Never changes `item`.
 */
export function gateItem(contract, item) {
  const pipeline = contract?.pipeline
  const given = item?.curation
  if (!isObject(given) || !DECISIONS.includes(given.decision)) {
    const curation = hold(
      {},
      'Held for review, not accepted: the curation answer is missing or unreadable.',
    )
    return { curation, route: 'reportItem' }
  }
  let curation = guardPromotion(
    pipeline ?? {},
    isObject(item.verification) ? item.verification : {},
    given,
  )
  if (curation.decision === 'accept') {
    const found = classifySafety(contract?.safety, { ...item, curation: given })
    if (found.safety) {
      curation = hold(
        curation,
        `Held for review, not accepted: safety item (${found.why.join('; ')}).`,
      )
    }
  }
  return { curation, route: routeFor(pipeline, curation.decision) }
}
