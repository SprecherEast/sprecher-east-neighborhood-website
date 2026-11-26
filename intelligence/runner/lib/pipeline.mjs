import { randomBytes } from 'node:crypto'

import { staleBoundaryProblem } from './boundary.mjs'
import { withoutSuggestions } from './cms.mjs'
import { createPlacer } from './place.mjs'
import { processRun } from './process.mjs'
import { submitItem } from './submit.mjs'
import { dateIn, isoNow } from './time.mjs'
import { checkUpcomingEvents, lowEventsWarning } from './upcoming.mjs'

// One run (README.md): scout every pilot source, then take each new or changed item through
// verify, curate and draft, and submit it; log the run in the CMS at the start and the end.

const COUNTS = ['seen', 'proposed', 'updates', 'rejected', 'duplicates', 'needsReview', 'deferred']

export const newRunId = (now) =>
  `intel-${now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}-${randomBytes(2).toString('hex')}`

/**
 * Runs the pipeline. `cms` is a connected or dry-run CMS (cms.mjs), `ask` a model adapter
 * (model.mjs), `state` the loaded state (changed in place; the caller saves it). Answers the run
 * log as sent, plus the calls built, for the digest.
 */
export async function runPipeline({
  contract,
  cms: suggestingCms,
  ask,
  state,
  http,
  robots,
  geocode = null,
  repoCommit,
  agentName = 'Sprecher East intelligence',
  now = () => new Date(),
}) {
  // Only submit gets the client that can suggest (gate.mjs); the run's other code gets this one
  const cms = withoutSuggestions(suggestingCms)
  // The one function that can suggest: the real client stays in this closure, so no other module
  // holds it, and it only runs submitItem, where the gate comes first (gate.mjs)
  const submit = (item, options) => submitItem(item, { ...options, cms: suggestingCms, contract })
  const startedAt = now()
  const { pipeline } = contract
  const budgets = pipeline.budgets ?? {}
  const runId = newRunId(startedAt)
  const counts = Object.fromEntries(COUNTS.map((k) => [k, 0]))
  const errors = []
  const cost = { inputTokens: 0, outputTokens: 0, usd: 0 }
  const calls = []
  const log = {
    runId,
    agentName,
    pipelineVersion: pipeline.version,
    repoCommit,
    startedAt: isoNow(startedAt),
    finishedAt: null,
    status: 'running',
    sourcesChecked: [],
    counts,
    errors,
    cost,
  }
  let upcoming = null
  const addError = (text) => errors.length < 50 && errors.push(String(text).slice(0, 500))
  const finish = async (status) => {
    log.status = status
    log.finishedAt = isoNow(now())
    // The run's identity (runId, agent, commit, start) can't change after it starts (#336)
    const { status: s, finishedAt, sourcesChecked, counts: c, errors: e, cost: k } = log
    await cms.updateRun(docId, {
      status: s,
      finishedAt,
      sourcesChecked,
      counts: c,
      errors: e,
      cost: k,
    })
    return { log, calls, upcoming }
  }

  if (pipeline.enabled === false) {
    log.status = 'disabled'
    log.finishedAt = log.startedAt
    await cms.createRun(log)
    return { log, calls }
  }
  const docId = await cms.createRun(log)

  const deferredSources = new Set()
  let stopped = null
  try {
    const stale = staleBoundaryProblem(contract.boundary, contract.area.boundary, startedAt)
    if (stale) addError(stale)
    // Where each item is: by the City's boundary when its address resolves (place.mjs)
    const place = createPlacer({
      boundary: contract.boundary,
      record: contract.area.boundary,
      geocode,
      onProblem: addError,
    })
    stopped = await processRun({
      contract,
      cms,
      submit,
      ask,
      state,
      http,
      robots,
      place,
      budgets,
      startedAt,
      runId,
      log,
      calls,
      addError,
      deferredSources,
    })
  } catch (error) {
    // Something no item could cause (the taxonomy can't be read, a bug): log it and stop
    addError(`run failed: ${error.message}`)
    stopped = 'failed'
  }
  try {
    // Counted after the run, so what it just suggested (unpublished drafts) never counts
    upcoming = await checkUpcomingEvents({
      cms,
      mark: pipeline.lowWater.upcomingEvents,
      today: dateIn(startedAt),
    })
    if (upcoming.error) addError(`upcoming events could not be counted: ${upcoming.error}`)
  } catch (error) {
    addError(`upcoming events could not be counted: ${error.message}`)
  }
  const status = stopped ?? (errors.length > 0 || counts.deferred > 0 ? 'partial' : 'succeeded')
  // A low list is a note in the run log's errors, added after the status so that it doesn't make
  // the run `partial` (the CMS run log has no field of its own for notes)
  const warning = upcoming ? lowEventsWarning(upcoming) : null
  if (warning) addError(warning)
  try {
    await finish(status)
  } catch (error) {
    // The run log couldn't be closed; the items handled are still recorded in the state
    console.error(`The run log could not be updated: ${error.message}`)
  }
  return { log, calls, upcoming }
}
