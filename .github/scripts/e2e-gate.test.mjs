import { describe, expect, it } from 'vitest'

import {
  MIN_EXEMPTION_REASON,
  e2eDecision,
  e2eExemption,
  e2eProblems,
  gateFor,
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

  it('runs when the tests, their workflow or the gate rules change', () => {
    for (const name of [
      'e2e/alignment.spec.ts',
      'playwright.config.ts',
      '.github/workflows/ci.yml',
      '.github/scripts/e2e-gate.mjs',
      '.github/scripts/pr-body.mjs',
      '.github/scripts/knowledge-sync.mjs',
      'scripts/ui-change.mjs',
      'scripts/behavior-change.mjs',
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

describe('e2eDecision: code the suite walks through', () => {
  it.each([
    'src/modules/accounts/actions.ts',
    'src/modules/accounts/use-cases/signUp.ts',
    'src/modules/contact/domain/limits.ts',
    'src/modules/verification/cms/emailConfirmations.ts',
    'src/payload.config.ts',
    'src/endpoints/seed/contact-form.ts',
    'src/endpoints/seed/contact-page.ts',
    'src/endpoints/seed/helpers/lexical.ts',
    'src/platform/richtext/editorial/factTabsFixtures.ts',
  ])('runs for a change to %s', (name) => {
    const decision = decide([code(name)])
    expect(decision.run).toBe(true)
    expect(decision.flows).toHaveLength(1)
  })

  it('ignores a test, a comment or a formatting edit there', () => {
    const comment = {
      filename: 'src/modules/accounts/actions.ts',
      patch: '@@ -1 +1 @@\n-// a\n+// b',
    }
    expect(decide([code('src/modules/accounts/actions.test.ts'), comment]).run).toBe(false)
  })

  it('can be exempted with a written reason, like a UI change', () => {
    const body = bodyWith(`End-to-end exemption: ${REASON}`)
    expect(decide([code('src/payload.config.ts')], body).run).toBe(false)
  })

  it('does not run for the other modules', () => {
    expect(decide([code('src/modules/events/domain/upcoming.ts')]).run).toBe(false)
  })
})

describe('e2eExemption: reasons keep their characters', () => {
  it('keeps underscores in the reason', () => {
    expect(
      e2eExemption(bodyWith('End-to-end exemption: only renames snake_case_names in a note'))
        .reason,
    ).toContain('snake_case_names')
  })
})

describe('gateFor: the job environment', () => {
  const env = { EVENT_NAME: 'pull_request', REPO: 'o/r', PR_NUMBER: '1' }

  it('decides from what it reads', () => {
    const read = { files: () => [CARD], body: () => '' }
    expect(gateFor(env, read).run).toBe(true)
    expect(gateFor(env, { files: () => [], body: () => '' }).run).toBe(false)
  })

  it('runs the tests when reading the pull request fails', () => {
    const read = {
      files: () => {
        throw new Error('HTTP 502\nsecond line')
      },
      body: () => '',
    }
    const decision = gateFor(env, read)
    expect(decision.run).toBe(true)
    expect(decision.reason).toContain('could not decide (HTTP 502)')
    expect(summaryOf(decision)).toContain('decision=run')
  })

  it('does not read anything for a push', () => {
    const read = {
      files: () => {
        throw new Error('not called')
      },
      body: () => '',
    }
    expect(gateFor({ EVENT_NAME: 'push' }, read).reason).toContain('push to main')
  })
})
