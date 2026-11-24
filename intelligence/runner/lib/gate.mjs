import { classifySafety, isObject } from './safety.mjs'
import { guardPromotion, holdForReview } from './stages.mjs'

// The one place that decides what may be accepted and which tool an item goes to. Submit calls it
// before anything is sent, so no stage, caller or setting can send a suggestion around it. An
// `accept` is let through only when verification is confident and unflagged (`promotionGuard`) and
// the item is not a safety item: its source isn't always held and neither stage says safety
// (safety.yaml). The gate reads no item text. Everything unreadable is held.

const SUGGESTION = 'submitSuggestion'
const REPORT = 'reportItem'

/** The decisions the curation schema allows; none known when the schema is missing, so all held. */
const decisionsOf = (contract) =>
  contract?.schemas?.['schemas/common.schema.json']?.$defs?.decision?.enum ?? []

/** The tool for `decision`; only a decision that survived the gate as `accept` may be a suggestion. */
function routeFor(pipeline, decision) {
  const wanted = pipeline?.routes?.[decision]
  if (decision === 'accept') return [SUGGESTION, REPORT, 'none'].includes(wanted) ? wanted : REPORT
  if (decision === 'reject' || decision === 'duplicate') return wanted === REPORT ? REPORT : 'none'
  return REPORT
}

/**
 * `{ curation, route, suggest }` for `item`: the curation to act on, with an `accept` turned into
 * `needs-review` (and the reason added) when it may not be accepted, the MCP tool to call, and
 * whether that is a suggestion. Never changes `item`.
 */
export function gateItem(contract, item) {
  const pipeline = contract?.pipeline
  const given = item?.curation
  if (!isObject(given) || !decisionsOf(contract).includes(given.decision)) {
    const curation = holdForReview({}, 'the curation answer is missing or unreadable')
    return { curation, route: REPORT, suggest: false }
  }
  const verification = isObject(item.verification) ? item.verification : {}
  let curation = guardPromotion(pipeline ?? {}, verification, given)
  if (curation.decision === 'accept') {
    const found = classifySafety(contract?.safety, { ...item, curation: given })
    if (found.safety) curation = holdForReview(curation, `safety item (${found.why.join('; ')})`)
  }
  const route = routeFor(pipeline, curation.decision)
  return { curation, route, suggest: route === SUGGESTION }
}
