import { isTransient } from './cms.mjs'
import { gateItem } from './gate.mjs'

// Submit (submit.md): route each item by its curate decision, build the whole MCP call, validate
// it against submission.schema.json, then send it, retrying a transient failure once. Code only.

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** The `submitSuggestion` arguments, from the draft and the candidate (submit.md step 2). */
export function suggestionArguments(item, runId) {
  const { draft, candidate } = item
  return {
    collection: draft.collection,
    title: draft.title,
    bodyMarkdown: draft.bodyMarkdown,
    summary: draft.summary,
    categories: draft.categories,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    allDay: draft.allDay,
    venue: draft.venue,
    address: draft.address,
    audience: draft.audience,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    externalId: candidate.externalId,
    contentHash: candidate.contentHash,
    runId,
  }
}

/** One line about the candidate and the decision, for an editor (report.schema.json `summary`). */
function summaryOf(item, note) {
  const { candidate, curation } = item
  const when = candidate.startsAt ? candidate.startsAt.slice(0, 16).replace('T', ' ') : 'no date'
  const parts = [
    note,
    `${candidate.title} (${when}${candidate.locationText ? `, ${candidate.locationText}` : ''}).`,
    curation ? `Decision: ${curation.decision}. ${curation.reasons.join(' ')}` : '',
  ]
  return clip(parts.filter(Boolean).join(' '), 1000)
}

/** The `reportItem` arguments for `kind` (submit.md step 2). */
export function reportArguments(item, runId, kind, { note = '', target, flags, evidence } = {}) {
  const { candidate, curation, verification } = item
  const targetCollection = target?.collection ?? curation?.targetCollection ?? null
  const targetId = target?.id ?? curation?.targetId ?? null
  return {
    runId,
    kind,
    targetCollection,
    targetId,
    externalId: candidate.externalId ?? null,
    summary: summaryOf(item, note),
    evidence: (evidence ?? verification?.evidence ?? []).slice(0, 5),
    flags: flags ?? verification?.flags ?? [],
    sourceUrl: candidate.sourceUrl ?? null,
  }
}

/** The image-candidate evidence lines (submit.md step 4): page link, image link and credit. */
export const imageEvidence = (item) =>
  (item.draft?.imageCandidates ?? []).map((image) => ({
    url: image.pageUrl,
    says: clip(`${image.imageUrl} — credit: ${image.credit}`, 500),
    retrievedAt: item.candidate.retrievedAt,
  }))

const envelope = (tool, runId, args) => ({
  tool,
  action: 'call',
  skipReason: null,
  runId,
  arguments: args,
})

/** Sends with one retry on a transient failure; throws after the second. */
async function send(fn) {
  try {
    return await fn()
  } catch (error) {
    if (!isTransient(error)) throw error
    return fn()
  }
}

/**
 * A report envelope, validated (submit.md step 3). One that fails its schema is rebuilt without
 * its evidence and flags, the parts that come from the model. Answers `{ call, errors }`; with
 * errors left, the call is marked `skip` and must not be sent.
 */
export function buildReport(item, runId, kind, options, validate) {
  let call = envelope('reportItem', runId, reportArguments(item, runId, kind, options))
  let errors = validate(call)
  if (errors.length > 0) {
    const plain = reportArguments(item, runId, kind, { ...options, evidence: [], flags: [] })
    call = envelope('reportItem', runId, plain)
    errors = validate(call)
  }
  if (errors.length > 0) {
    call.action = 'skip'
    call.skipReason = clip(errors.join('; '), 300)
  }
  return { call, errors }
}

/** Builds, validates and sends a report; throws when it can't be sent. */
export async function sendReport(item, { cms, runId, validate, calls }, kind, options) {
  const { call, errors } = buildReport(item, runId, kind, options, validate)
  calls.push(call)
  if (errors.length > 0) {
    // Marked, so the caller logs it and moves on: retrying tomorrow would fail the same way
    throw Object.assign(
      new Error(`the ${kind} report failed its schema: ${errors.slice(0, 2).join('; ')}`),
      { invalid: true },
    )
  }
  await send(() => cms.reportItem(call.arguments))
}

/**
 * Submits one item. `cms` has `submitSuggestion` and `reportItem`, `contract` holds the gate, and
 * `validate` checks an envelope against submission.schema.json. The gate runs first and decides
 * the decision and the tool; only `submitSuggestion` builds a suggestion. Answers
 * `{ outcome, id?, calls, warnings }`, where `calls` lists every envelope built (for the dry-run
 * digest), and outcome is one of `created`, `duplicate`, `reported`, `none` (the gate named no
 * tool: nothing is built or sent), `rejected-invalid`, `review` (sent for review after a failure)
 * or `deferred`.
 */
export async function submitItem(rawItem, { cms, runId, validate, contract }) {
  if (!contract) throw new Error('submitItem needs the contract, which holds the gate')
  // Whatever the caller expects, the gate decides the decision and the tool (gate.mjs)
  const { curation, route } = gateItem(contract, rawItem)
  const item = { ...rawItem, curation }
  const calls = []
  const warnings = []
  const report = (kind, options) => sendReport(item, { cms, runId, validate, calls }, kind, options)
  /** A follow-up on a stored suggestion: its failure is logged, never undoes the suggestion. */
  const pending = []
  const followUp = async (kind, options) => {
    try {
      await report(kind, options)
    } catch (error) {
      warnings.push(`${item.candidate.externalId}: follow-up report not sent: ${error.message}`)
      // Sent at the start of the next run (state.pendingReports), unless it can't pass its schema
      const last = calls.at(-1)
      if (!error.invalid && last?.tool === 'reportItem') pending.push(last.arguments)
    }
  }

  if (route === 'reportItem') {
    const kind = item.curation.decision === 'needs-review' ? 'needs-review' : item.curation.decision
    await report(kind)
    return { outcome: 'reported', calls, warnings }
  }
  // Only the gate's `submitSuggestion` goes on to build a suggestion; anything else ends here
  if (route !== 'submitSuggestion') return { outcome: 'none', calls, warnings }

  const call = envelope('submitSuggestion', runId, suggestionArguments(item, runId))
  calls.push(call)
  const errors = validate(call)
  if (errors.length > 0) {
    call.action = 'skip'
    call.skipReason = clip(errors.join('; '), 300)
    await report('rejected-invalid', {
      note: `Invalid suggestion: ${errors.slice(0, 3).join('; ')}.`,
      flags: [],
    })
    return { outcome: 'rejected-invalid', calls, warnings }
  }

  let answer
  try {
    answer = await send(() => cms.submitSuggestion(call.arguments))
  } catch (error) {
    try {
      await report('needs-review', {
        note: `Could not store the suggestion: ${String(error.message).slice(0, 200)}.`,
      })
      return { outcome: 'review', calls, warnings }
    } catch {
      return { outcome: 'deferred', calls, warnings }
    }
  }
  if (answer.status === 'duplicate') return { outcome: 'duplicate', id: answer.id, calls, warnings }

  const target = { collection: item.draft.collection, id: answer.id }
  const missing = item.draft.missing ?? []
  if (missing.length > 0 || item.draft.confidence === 'low') {
    await followUp('needs-review', {
      target,
      note: `Check before publishing: ${missing.join(', ') || 'low confidence'}.`,
    })
  }
  const images = imageEvidence(item)
  if (images.length > 0) {
    await followUp('needs-review', {
      target,
      flags: ['image-candidate'],
      evidence: images,
      note: 'The source shows an image. Ask for permission before using it, or keep the category image.',
    })
  }
  return { outcome: 'created', id: answer.id, calls, warnings, pending }
}
