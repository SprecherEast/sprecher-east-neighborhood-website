import { randomBytes } from 'node:crypto'

import { withoutSuggestions } from './cms.mjs'
import { processRun } from './process.mjs'
import { isoNow } from './time.mjs'

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
  repoCommit,
  agentName = 'Sprecher East intelligence',
  now = () => new Date(),
}) {
  // Only submit gets the client that can suggest (gate.mjs); the run's other code gets this one
  const cms = withoutSuggestions(suggestingCms)
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
    return { log, calls }
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
    stopped = await processRun({
      contract,
      cms,
      suggestingCms,
      ask,
      state,
      http,
      robots,
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
  const status = stopped ?? (errors.length > 0 || counts.deferred > 0 ? 'partial' : 'succeeded')
  try {
    await finish(status)
  } catch (error) {
    // The run log couldn't be closed; the items handled are still recorded in the state
    console.error(`The run log could not be updated: ${error.message}`)
  }
  return { log, calls }
}
