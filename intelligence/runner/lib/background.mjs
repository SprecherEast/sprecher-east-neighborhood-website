import { readFileSync } from 'node:fs'
import path from 'node:path'

// The neighborhood background the model stages are given (stage-context.md,
// #1434). A short summary goes to every listed stage; a topic note goes in only when verify named
// it for the item (`$.backgroundTopics`, judged by the model, not by words in code) and only while
// it fits the one budget in pipeline.yaml (`background.maxTokens`). Nothing here reads an item.

/** The stage that is shown the list of topic notes, because it is the one that names them. */
export const NAMING_STAGE = 'verify'

/** A cheap size estimate, four characters to a token, rounded up: enough to hold a budget. */
export const estimateTokens = (text) => Math.ceil(String(text).length / 4)

const read = (dir, file) => {
  const text = readFileSync(path.join(dir, file), 'utf8').trim()
  return { file, text, tokens: estimateTokens(text) }
}

const topicList = (topics) =>
  [
    'Detailed notes you can ask for. Name the one this item turns on most in `$.backgroundTopics`',
    '(at most one); the next stage is given it. Leave it empty when the summary is enough.',
    ...topics.map((t) => `- ${t.id}: ${t.covers}`),
  ].join('\n')

/**
 * Reads the summary and the topic notes `config` (pipeline.yaml `background`) lists from `dir`.
 * Throws when a file is missing, a topic id repeats, or the summary with its topic list is over
 * the budget, so a bad setting stops the start and not a run.
 */
export function loadBackground(dir, config) {
  const summary = read(dir, config.summary)
  const topics = new Map()
  for (const entry of config.topics) {
    if (topics.has(entry.id)) throw new Error(`background topic ${entry.id} is listed twice`)
    topics.set(entry.id, { ...entry, ...read(dir, entry.file) })
  }
  const list = config.topics.length > 0 ? topicList(config.topics) : ''
  const background = {
    stages: new Set(config.stages),
    maxTokens: config.maxTokens,
    summary,
    topics,
    list: { text: list, tokens: estimateTokens(list) },
  }
  const always = summary.tokens + background.list.tokens
  if (always > config.maxTokens) {
    throw new Error(
      `the background summary and topic list are about ${always} tokens, over the budget of ${config.maxTokens} (pipeline.yaml, background.maxTokens)`,
    )
  }
  return background
}

/**
 * What to add to `stageId`'s message: the summary, the topic list for the naming stage, and the
 * `requested` topic notes in the order named while they fit the budget. Answers the text and a
 * `report` (tokens, topics given, topics skipped and why), or an empty text and a null report for
 * a stage that is not listed.
 */
export function backgroundFor(background, stageId, requested = []) {
  if (!background?.stages.has(stageId)) return { text: '', listTokens: 0, report: null }
  const list = stageId === NAMING_STAGE ? background.list : { text: '', tokens: 0 }
  const parts = [background.summary.text, list.text]
  let tokens = background.summary.tokens + list.tokens
  const topics = []
  const skipped = []
  for (const id of new Set(requested)) {
    const note = background.topics.get(id)
    if (!note) skipped.push({ id, reason: 'unknown' })
    else if (tokens + note.tokens > background.maxTokens)
      skipped.push({ id, reason: 'over-budget' })
    else {
      parts.push(note.text)
      tokens += note.tokens
      topics.push({ id, tokens: note.tokens })
    }
  }
  return {
    text: parts.filter(Boolean).join('\n\n'),
    listTokens: list.tokens,
    report: { stageId, tokens, topics, skipped },
  }
}

/** A run's count of what each model call was given, for the one note in the run log. */
export function newTally() {
  const stages = new Map()
  const given = new Map()
  const skipped = new Map()
  let summaryTokens = 0
  return {
    add(stageId, report) {
      if (!report) return
      stages.set(stageId, (stages.get(stageId) ?? 0) + 1)
      summaryTokens ||= report.tokens - report.topics.reduce((sum, t) => sum + t.tokens, 0)
      for (const t of report.topics) given.set(t.id, (given.get(t.id) ?? 0) + 1)
      for (const s of report.skipped) {
        const key = `${s.id} (${s.reason})`
        skipped.set(key, (skipped.get(key) ?? 0) + 1)
      }
    },
    stages,
    given,
    skipped,
    get summaryTokens() {
      return summaryTokens
    },
  }
}

const times = (map) => [...map].map(([name, n]) => `${name} x${n}`).join(', ')

/** The run log's one note on what the background added: what went in, and what was left out. */
export function backgroundNote(tally, config) {
  if (tally.stages.size === 0) return 'Background: no model stage ran, so nothing was loaded.'
  const parts = [
    `Background: the summary (about ${tally.summaryTokens} tokens, with verify's topic list) went to ${times(tally.stages)}`,
    tally.given.size > 0
      ? `topic notes given: ${times(tally.given)}`
      : 'no topic note was asked for',
  ]
  if (tally.skipped.size > 0) parts.push(`left out: ${times(tally.skipped)}`)
  parts.push(`budget ${config.maxTokens} tokens a call`)
  return `${parts.join('; ')}.`
}
