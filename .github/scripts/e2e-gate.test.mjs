import { describe, expect, it } from 'vitest'

import {
  MIN_EXEMPTION_REASON,
  e2eDecision,
  e2eExemption,
  e2eProblems,
  summaryOf,
} from './e2e-gate.mjs'

const REASON = 'Only renames a CSS variable that no screen reads yet'
const bodyWith = (line) => `Closes #1\n\n## How to test\n\n1. Open it\n${line}\n\n## Why\nx`
const code = (filename) => ({
  filename,
  status: 'modified',
  patch: '@@ -1 +1 @@\n-<p className="p-2" />\n+<p className="p-4" />',
})
const CARD = code('src/modules/events/ui/EventCard.tsx')
const decide = (files, body = '', event = 'pull_request') => e2eDecision({ event, files, body })

describe('e2eExemption: the line in the description', () => {
  it.each([
    ['End-to-end exemption: none', 'none'],
    ['End-to-end exemption:', 'none'],
    ['- **End-to-end exemption:** n/a', 'none'],
    ['End-to-end exemption: run', 'run'],
    ['end-to-end exemption : RUN.', 'run'],
  ])('reads %j as %s', (line, kind) => {
    expect(e2eExemption(bodyWith(line)).kind).toBe(kind)
  })

  it('reads the reason of an exemption', () => {
    expect(e2eExemption(bodyWith(`End-to-end exemption: ${REASON}`))).toEqual({
      kind: 'exempt',
      reason: REASON,
    })
  })

  it('finds no line as none, and ignores one hidden in an HTML comment', () => {
    expect(e2eExemption('## Why\nx').kind).toBe('none')
    expect(e2eExemption(bodyWith(`<!-- End-to-end exemption: ${REASON} -->`)).kind).toBe('none')
    expect(e2eExemption(undefined).kind).toBe('none')
  })
})

describe('e2eDecision: do the browser tests run', () => {
  it('runs on a push to main whatever changed', () => {
    expect(decide([], '', 'push').run).toBe(true)
  })

  it('runs for a UI change and names the files', () => {
    const decision = decide([CARD])
    expect(decision.run).toBe(true)
    expect(decision.ui.map((f) => f.filename)).toEqual([CARD.filename])
  })

  it('skips when nothing in the UI changed', () => {
    const decision = decide([code('src/modules/events/domain/upcoming.ts'), code('docs/a.md')])
    expect(decision).toMatchObject({ run: false, ui: [] })
  })

  it('skips a comment-only or whitespace-only edit of a UI file', () => {
    const comment = { ...CARD, patch: '@@ -1 +1 @@\n-// old\n+// new' }
    expect(decide([comment]).run).toBe(false)
  })

  it('skips a UI change with a written reason of enough length', () => {
    const decision = decide([CARD], bodyWith(`End-to-end exemption: ${REASON}`))
    expect(decision.run).toBe(false)
    expect(decision.reason).toContain(REASON)
    expect(decision.ui).toHaveLength(1)
  })

  it('does not skip for a reason that is too short', () => {
    expect(decide([CARD], bodyWith('End-to-end exemption: not needed')).run).toBe(true)
  })

  it('runs when the description asks for it, even with no UI change', () => {
    expect(decide([], bodyWith('End-to-end exemption: run')).run).toBe(true)
  })

  it('runs when the tests or their workflow change', () => {
    for (const name of [
      'e2e/alignment.spec.ts',
      'playwright.config.ts',
      '.github/workflows/ci.yml',
    ]) {
      expect(decide([code(name)]).run, name).toBe(true)
    }
  })

  it('runs for the infrastructure even when a UI change is exempt', () => {
    const files = [CARD, code('e2e/alignment.spec.ts')]
    expect(decide(files, bodyWith(`End-to-end exemption: ${REASON}`)).run).toBe(true)
  })
})

describe('e2eProblems: what PR Policy checks', () => {
  it('has none without an exemption or with a good one', () => {
    expect(e2eProblems({ body: bodyWith('End-to-end exemption: none') })).toEqual([])
    expect(e2eProblems({ body: bodyWith(`End-to-end exemption: ${REASON}`) })).toEqual([])
    expect(e2eProblems({ body: bodyWith('End-to-end exemption: run') })).toEqual([])
  })

  it('asks for a reason of enough length', () => {
    const problems = e2eProblems({ body: bodyWith('End-to-end exemption: not needed') })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(String(MIN_EXEMPTION_REASON))
  })
})

describe('summaryOf: what the job prints', () => {
  it('states the decision, the reason and each UI file on readable lines', () => {
    const text = summaryOf(decide([CARD]))
    expect(text).toContain('e2e-gate: decision=run')
    expect(text).toContain('src/modules/events/ui/EventCard.tsx (code changed)')
  })

  it('states a skip', () => {
    expect(summaryOf(decide([]))).toContain('e2e-gate: decision=skip')
  })
})
