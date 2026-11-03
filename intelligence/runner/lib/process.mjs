import { pilotSources } from './contract.mjs'
import { mergeAcrossSources, mergedCopies, scoutSource } from './scout.mjs'
import { runStage, runVerify, StageError } from './stages.mjs'
import { markSeen } from './state.mjs'
import { sendReport, submitItem } from './submit.mjs'

// The work of one run (pipeline.mjs opens and closes it): scout every pilot source, then take
// each new or changed item through the model stages and submit, within the budgets.

const MAX_FAILURES_IN_A_ROW = 3

/** Scout, the model stages and submit. Answers a stop status, or null when the run went through. */
export async function processRun(run) {
  // What the run reads, then what it records into
  const { contract, cms, ask, state, http, robots, budgets } = run
  const { startedAt, runId, log, calls, addError, deferredSources } = run
  const { counts, cost } = log
  const { pipeline } = contract
  // Measured on the real clock, whatever `now` says (tests pin it)
  const deadline = Date.now() + (budgets.maxMinutesPerRun ?? 15) * 60_000
  const taxonomy = await cms.taxonomy()
  const validateCandidate = contract.validator('schemas/candidate.schema.json')
  const validateEnvelope = contract.validator('schemas/submission.schema.json')
  const context = { cms, runId, validate: validateEnvelope, calls }
  // What the registry says about each source: verify trusts an official feed's own fields
  // (prompts/verify.md, "What the feed already says")
  const sourceFacts = new Map(
    contract.registry.sources.map(({ id, owner, reliability, scope }) => [
      id,
      { id, owner, reliability, scope },
    ]),
  )

  // 0. Follow-up reports an earlier run couldn't send (the suggestion they point at is stored)
  const waiting = state.pendingReports ?? []
  state.pendingReports = []
  for (const args of waiting) {
    try {
      await cms.reportItem({ ...args, runId })
      calls.push({ tool: 'reportItem', arguments: { ...args, runId } })
    } catch (error) {
      state.pendingReports.push(args)
      addError(`a follow-up report from an earlier run is still waiting: ${error.message}`)
    }
  }

  // 1. Scout, in rank order
  const scouted = []
  for (const source of pilotSources(contract.registry)) {
    const result = await scoutSource(source, {
      state,
      http,
      robots,
      budgets,
      validate: validateCandidate,
      area: contract.area,
      now: startedAt,
    })
    log.sourcesChecked.push(result.check)
    if (result.check.error && result.check.status !== 'skipped') {
      addError(`${source.id}: ${result.check.error}`)
    }
    if (result.deferred > 0) {
      counts.deferred += result.deferred
      deferredSources.add(source.id)
    }
    // An invalid candidate is reported once, then counted as handled
    for (const { candidate, errors: problems } of result.invalid) {
      try {
        await sendReport({ candidate }, context, 'rejected-invalid', {
          note: `Invalid candidate: ${problems.slice(0, 3).join('; ')}.`,
          flags: [],
        })
        counts.rejected++
        counts.seen++
        markSeen(state, candidate.externalId, candidate.contentHash)
      } catch (error) {
        addError(`${candidate.externalId}: ${error.message}`)
        if (error.invalid) {
          markSeen(state, candidate.externalId, candidate.contentHash)
        } else {
          counts.deferred++
          deferredSources.add(source.id)
        }
      }
    }
    scouted.push({ source, ...result })
  }
  // Taken in turns, one source at a time, so a small budget still samples every source
  const candidates = takeTurns(
    mergeAcrossSources(scouted.map((s) => s.candidates)).filter((c) => c.change !== 'unchanged'),
  )

  // 2. Model stages and submit, one item at a time
  let modelItems = 0
  let drafts = 0
  let failuresInARow = 0
  let stopped = null
  for (const candidate of candidates) {
    const copies = mergedCopies(candidate)
    const defer = () => {
      counts.deferred++
      deferredSources.add(candidate.sourceId)
      for (const copy of copies) deferredSources.add(copy.sourceId)
    }
    if (stopped || Date.now() > deadline || modelItems >= (budgets.maxModelItemsPerRun ?? 40)) {
      stopped ??= 'stopped-budget'
      defer()
      continue
    }
    const item = { candidate, source: sourceFacts.get(candidate.sourceId), taxonomy }
    try {
      item.known = await cms.known(candidate.externalId)
      modelItems++
      const verify = await runVerify(contract, ask, item, { deadline })
      item.verification = verify.output
      const curate = await runStage(contract, ask, 'curate', item, { deadline })
      item.curation = curate.output
      addUsage(cost, verify.usage, curate.usage)
      const route = pipeline.routes?.[item.curation.decision] ?? 'none'
      if (route === 'submitSuggestion') {
        if (drafts >= (budgets.maxDraftsPerRun ?? 10)) {
          defer()
          continue
        }
        const draft = await runStage(contract, ask, 'draft', item, { deadline })
        item.draft = draft.output
        addUsage(cost, draft.usage)
        drafts++
      }
      if (route === 'none') {
        counts[item.curation.decision === 'duplicate' ? 'duplicates' : 'rejected']++
      } else {
        const result = await submitItem(item, { cms, runId, validate: validateEnvelope, route })
        calls.push(...result.calls)
        for (const warning of result.warnings) addError(warning)
        if (result.pending?.length) {
          state.pendingReports = [...(state.pendingReports ?? []), ...result.pending].slice(-50)
        }
        if (result.outcome === 'deferred')
          throw new Error('the CMS took neither the suggestion nor a report')
        if (result.outcome === 'created') counts.proposed++
        if (result.outcome === 'duplicate') counts.duplicates++
        if (result.outcome === 'rejected-invalid') counts.rejected++
        if (result.outcome === 'review' || item.curation.decision === 'needs-review')
          counts.needsReview++
        if (['update', 'cancel'].includes(item.curation.decision)) counts.updates++
      }
    } catch (error) {
      if (error instanceof StageError) {
        // The model answered, but not to the schema twice: the item goes to an editor
        addUsage(cost, error.usage)
        try {
          await sendReport(item, context, 'needs-review', {
            note: `The ${error.stageId} stage failed: ${error.errors.slice(0, 3).join('; ')}.`,
          })
          counts.needsReview++
        } catch (reportError) {
          addError(`${candidate.externalId}: ${reportError.message}`)
          if (!reportError.invalid) {
            defer()
            stopped ??= stopAfter(++failuresInARow, deadline)
            continue
          }
          counts.rejected++
        }
      } else if (error.invalid) {
        // A report that can't pass its schema even without the model's parts: logged, handled
        addError(`${candidate.externalId}: ${error.message}`)
        counts.rejected++
      } else {
        // The model or the CMS is down, or time ran out: keep the item for the next run
        addError(`${candidate.externalId}: ${error.message}`)
        defer()
        stopped ??= stopAfter(++failuresInARow, deadline)
        continue
      }
    }
    failuresInARow = 0
    counts.seen++
    markSeen(state, candidate.externalId, candidate.contentHash)
    for (const copy of copies) markSeen(state, copy.externalId, copy.contentHash)
  }

  // 3. A source's ETag and cursor move on only when all of its items were handled
  for (const s of scouted) {
    if (s.fetchState && !deferredSources.has(s.source.id)) state.sources[s.source.id] = s.fetchState
  }
  return stopped
}

/** After a failure: out of time is a budget stop; three failures in a row stop the run. */
function stopAfter(failuresInARow, deadline) {
  if (Date.now() > deadline - 60_000) return 'stopped-budget'
  return failuresInARow >= MAX_FAILURES_IN_A_ROW ? 'partial' : null
}

/** The candidates in turns by source (first of each, then second of each...), each in its order. */
export function takeTurns(candidates) {
  const bySource = new Map()
  for (const c of candidates) {
    if (!bySource.has(c.sourceId)) bySource.set(c.sourceId, [])
    bySource.get(c.sourceId).push(c)
  }
  const queues = [...bySource.values()]
  const turns = []
  for (let i = 0; turns.length < candidates.length; i++) {
    for (const queue of queues) if (i < queue.length) turns.push(queue[i])
  }
  return turns
}

function addUsage(cost, ...usages) {
  for (const u of usages) {
    cost.inputTokens += u?.input ?? 0
    cost.outputTokens += u?.output ?? 0
  }
}
