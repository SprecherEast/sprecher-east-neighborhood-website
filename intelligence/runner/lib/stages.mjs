import { backgroundFor } from './background.mjs'
import { composeMessage, extractJson } from './model.mjs'

// One model stage (README.md, "How a runtime loads it", step 4): the stage's prompt, coverage.md,
// the neighborhood background it is due (background.mjs) and the item go to the model; the answer must validate against the stage's output schema. An
// answer that doesn't validate is retried once, with the errors; then the item goes to review.

export class StageError extends Error {
  constructor(stageId, errors) {
    super(`${stageId}: the answer failed its schema twice: ${errors.slice(0, 5).join('; ')}`)
    this.stageId = stageId
    this.errors = errors
  }
}

/** Thinking levels for the pipeline's `model` setting (`none` stages never reach here). */
const THINKING = { low: 'low', medium: 'medium', high: 'high' }

/**
 * Runs `stageId` on `item` with `ask` (a model adapter). Answers `{ output, usage, attempts }`.
 * `effort` overrides the stage's own level, as verify's escalation does. `topics` are the
 * background topic notes to add (default: the ones verify named for the item), and `tally` counts
 * what each call was given, for the run log.
 */
export async function runStage(
  contract,
  ask,
  stageId,
  item,
  { effort, deadline, topics = item.verification?.backgroundTopics, tally } = {},
) {
  const stage = contract.stage(stageId)
  const validate = contract.validator(stage.output)
  const background = backgroundFor(contract.background, stageId, topics ?? [])
  const base = composeMessage({
    stageId,
    prompt: contract.prompts[stageId],
    coverage: contract.coverage,
    background: background.text,
    schemas: contract.schemas,
    outputSchema: stage.output,
    item,
  })
  const usage = { input: 0, output: 0 }
  let message = base
  let errors = []
  // Once an answer says safety, the stage's result does, even when it was retried (#1007)
  let flagged = false
  for (let attempt = 1; attempt <= 2; attempt++) {
    tally?.add(stageId, background.report)
    const answer = await ask({
      stageId,
      message,
      item,
      deadline,
      thinking: THINKING[effort ?? stage.model],
    })
    usage.input += answer.usage?.input ?? 0
    usage.output += answer.usage?.output ?? 0
    let output
    try {
      output = extractJson(answer.text)
      flagged ||= output?.safety === true
      errors = validate(output)
    } catch (error) {
      errors = [error.message]
    }
    if (errors.length === 0) {
      return { output: flagged ? { ...output, safety: true } : output, usage, attempts: attempt }
    }
    message = `${base}\n\n## Your previous answer was invalid\n${errors.slice(0, 10).join('\n')}\nAnswer again with one valid JSON object.`
  }
  throw Object.assign(new StageError(stageId, errors), { usage })
}

/**
 * Verify, rerun once at high effort when its confidence is below the pipeline's threshold
 * (`escalation` in pipeline.yaml). Answers the stage result and whether it escalated.
 */
export async function runVerify(contract, ask, item, { deadline, tally } = {}) {
  const first = await runStage(contract, ask, 'verify', item, { deadline, tally })
  const { verifyBelowConfidence = 0.6, to = 'high' } = contract.pipeline.escalation ?? {}
  if (first.output.confidence >= verifyBelowConfidence) return { ...first, escalated: false }
  // The rerun is given the topic notes the first answer asked for
  const topics = first.output.backgroundTopics
  const second = await runStage(contract, ask, 'verify', item, {
    effort: to,
    deadline,
    topics,
    tally,
  })
  const usage = {
    input: first.usage.input + second.usage.input,
    output: first.usage.output + second.usage.output,
  }
  // The rerun may be surer, but a first safety answer is never lost (#1007)
  const output = first.output.safety === true ? { ...second.output, safety: true } : second.output
  return { ...second, output, usage, escalated: true }
}

/**
 * The promotion guard (pipeline.yaml `promotionGuard`, #870): an `accept` whose verification is
 * below the confidence threshold or carries a blocking flag becomes `needs-review`, whatever the
 * model decided. Answers the curation to route, with the reason added when it was downgraded.
 */
export function guardPromotion(pipeline, verification, curation) {
  if (curation.decision !== 'accept') return curation
  const { verifyBelowConfidence = 0.6 } = pipeline.escalation ?? {}
  const blocking = new Set(pipeline.promotionGuard?.blockingFlags ?? [])
  const problems = []
  if (!(verification.confidence >= verifyBelowConfidence)) {
    problems.push(
      `verification confidence ${verification.confidence} is not at least ${verifyBelowConfidence}`,
    )
  }
  const flagged = (verification.flags ?? []).filter((flag) => blocking.has(flag))
  if (flagged.length > 0) problems.push(`verification flags: ${flagged.join(', ')}`)
  return problems.length === 0 ? curation : holdForReview(curation, problems.join('; '))
}

/**
 * `curation` as a `needs-review` decision, with `problem` as the first reason: the one way any
 * guard (this file's and gate.mjs's) holds an accept.
 */
export function holdForReview(curation, problem) {
  const earlier = Array.isArray(curation.reasons) ? curation.reasons : []
  const reasons = [`Held for review, not accepted: ${problem}.`, ...earlier]
    .filter((reason) => typeof reason === 'string' && reason.length > 0)
    .map((reason) => reason.slice(0, 300))
  return { ...curation, decision: 'needs-review', reasons: reasons.slice(0, 5) }
}
