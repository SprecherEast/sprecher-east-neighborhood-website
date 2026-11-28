// The background checks of scripts/check-intelligence.mjs (#1434): an eval case that says what
// background a stage was given names only what pipeline.yaml sets up, and a `-without-background`
// case has a `-with-background` partner with the same input and a different result, so the pair
// shows what the context changes.

import path from 'node:path'

import { loadBackground } from '../intelligence/runner/lib/background.mjs'

const WITHOUT = '-without-background'
const WITH = '-with-background'

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** The problems with the eval cases' background, as messages. `config` is pipeline.yaml's `background`. */
export function backgroundProblems(cases, config) {
  const found = []
  const topics = new Set((config?.topics ?? []).map((t) => t.id))
  const given = new Set(config?.stages ?? [])
  const byId = new Map(cases.map((c) => [c.id, c]))
  for (const c of cases) {
    const bg = c.background
    if (bg) {
      if (!given.has(c.stage)) found.push(`${c.id}: ${c.stage} is not given any background`)
      for (const id of bg.topics ?? [])
        if (!topics.has(id)) found.push(`${c.id}: background topic ${id} is not in pipeline.yaml`)
      if (!bg.summary && (bg.topics ?? []).length > 0)
        found.push(`${c.id}: topic notes come with the summary: background needs the summary`)
    }
    if (c.id.endsWith(WITHOUT)) {
      if (bg?.summary) found.push(`${c.id}: a without-background case has no summary`)
      const partner = byId.get(c.id.slice(0, -WITHOUT.length) + WITH)
      if (!partner) found.push(`${c.id}: needs ${c.id.slice(0, -WITHOUT.length)}${WITH}`)
      else {
        if (!same(c.input, partner.input)) found.push(`${c.id}: the pair must take the same input`)
        if (same(c.expected, partner.expected))
          found.push(
            `${c.id}: the pair must reach a different result, or the background changes nothing`,
          )
      }
    }
    if (c.id.endsWith(WITH)) {
      if (!bg?.summary) found.push(`${c.id}: a with-background case needs the summary`)
      if (!byId.has(c.id.slice(0, -WITH.length) + WITHOUT))
        found.push(`${c.id}: needs ${c.id.slice(0, -WITH.length)}${WITHOUT}`)
    }
  }
  return found
}

/**
 * Every background problem of the intelligence folder as `[file, message]`: the files
 * `pipeline.yaml` names exist and fit the budget, and the eval cases follow `backgroundProblems`.
 */
export function backgroundChecks(dir, cases, pipeline) {
  const config = pipeline?.background
  if (!config) return []
  const found = []
  try {
    loadBackground(dir, config)
  } catch (error) {
    found.push([path.join(dir, 'pipeline.yaml'), error.message])
  }
  for (const message of backgroundProblems(cases, config))
    found.push([path.join(dir, 'evals'), message])
  return found
}
