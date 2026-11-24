import { classifySafety } from '../intelligence/runner/lib/safety.mjs'

// The route checks of scripts/check-intelligence.mjs (#1007): where an eval case says an item goes
// must be where the pipeline's routes and the safety gate send it.

/**
 * Whether the gate would hold this case's item for its source: it holds an accept whose source is
 * listed (runner/lib/gate.mjs) whatever the stages answered, so it goes to a person. The stages'
 * answers are taken as "not safety", the way a real answer would pass, and the gate reads no text.
 */
export const heldBySafety = (c, { rules, registry }) =>
  classifySafety(rules, {
    candidate: c.input ?? {},
    source: registry.get(c.input?.sourceId),
    verification: { ...c.given?.verification, safety: false },
    curation: { ...c.given?.curation, safety: false },
  }).safety

const HELD = (id) =>
  `${id}: the gate holds this accept (its source is always held), so it routes to reportItem`

/**
 * The problems with one eval case's expected route and decision, as messages.
 * `routes` is pipeline.yaml's decision-to-tool map; `registry` maps source ids to their entries.
 */
export function routeProblems(c, { routes, registry, rules }) {
  const e = c.expected
  const ctx = { rules, registry }
  const found = []
  // A case with no decision of its own that expects a suggestion (a draft, a submit) assumes an accept
  if (e?.route === 'submitSuggestion' && !e.decision) {
    if (c.given?.curation?.decision !== 'accept')
      found.push(`${c.id}: a suggestion follows an accept, not ${c.given?.curation?.decision}`)
    else if (heldBySafety(c, ctx)) found.push(HELD(c.id))
  }
  if (!e?.decision) return found
  // duplicate, update and cancel name the known document; nothing else names one
  const known = ['duplicate', 'update', 'cancel'].includes(e.decision) ? c.known : null
  if ((e.targetId ?? null) !== (known?.id ?? null))
    found.push(`${c.id}: targetId must be ${known?.id ?? 'null'}`)
  if ((e.targetCollection ?? null) !== (known?.collection ?? null))
    found.push(`${c.id}: targetCollection must be ${known?.collection ?? 'null'}`)
  if (e.safety === true && e.decision === 'accept')
    found.push(`${c.id}: a safety item is never accepted`)
  const isHeld = e.decision === 'accept' && heldBySafety(c, ctx)
  if ((isHeld ? 'reportItem' : routes[e.decision]) !== e.route)
    found.push(isHeld ? HELD(c.id) : `${c.id}: ${e.decision} routes to ${routes[e.decision]}`)
  return found
}
