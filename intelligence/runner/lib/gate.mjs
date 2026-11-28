import { unreadReport } from './pageRead.mjs'
import { classifySafety, isObject } from './safety.mjs'
import { guardPromotion, holdForReview } from './stages.mjs'

// The one place that decides what may be accepted and which tool an item goes to. Submit calls it
// before anything is sent, so no stage, caller or setting can send a suggestion around it. An
// `accept` is let through only when verification is confident and unflagged (`promotionGuard`) and
// the item is not a safety item: its source isn't always held and neither stage says safety
// (safety.yaml). The gate reads no item text. Everything unreadable is held.

const SUGGESTION = 'submitSuggestion'
const REPORT = 'reportItem'
/** The decisions that send an item nowhere, so no person ever sees it. */
const DROPS = ['reject', 'duplicate']

/** The decisions the curation schema allows; none known when the schema is missing, so all held. */
const decisionsOf = (contract) =>
  contract?.schemas?.['schemas/common.schema.json']?.$defs?.decision?.enum ?? []

/** The tool for `decision`; only a decision that survived the gate as `accept` may be a suggestion. */
function routeFor(pipeline, decision) {
  const wanted = pipeline?.routes?.[decision]
  if (decision === 'accept') return [SUGGESTION, REPORT, 'none'].includes(wanted) ? wanted : REPORT
  if (DROPS.includes(decision)) return wanted === REPORT ? REPORT : 'none'
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
  // A reject or a duplicate of an item from an always-held source is held unless verify was given
  // its page's text (pageRead.mjs): the code knows whether it was, so a report whose page was not
  // read can only end in review, whatever curate decides. Those two are the decisions that drop an
  // item; every other one already goes to a person.
  if (DROPS.includes(curation.decision) && unreadReport(contract?.safety, item))
    curation = holdForReview(
      curation,
      'verify was not given the report page, so it may not have been read',
    )
  const route = routeFor(pipeline, curation.decision)
  return { curation, route, suggest: route === SUGGESTION }
}
