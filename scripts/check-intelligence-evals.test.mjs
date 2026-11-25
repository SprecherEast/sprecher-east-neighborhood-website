import { afterAll, describe, expect, it } from 'vitest'

import { copyIntelligence, removeCopies, runCheck } from './check-intelligence-harness.mjs'

// The eval check asks the same rules as the gate where an eval case expects an item to go (#1007).
// The logic is tested in check-intelligence-routes.test.mjs; these run the script on a copy of the
// evals with one more case.

afterAll(removeCopies)

/** The check on a copy with one more eval case for `stage`; `given` is the curation decision it assumes. */
function check({ stage, sourceId, given = null, expected }) {
  const assumed = given
    ? `\n    given:\n      curation: { decision: ${given}, audiences: [everyone] }`
    : ''
  const dir = copyIntelligence({
    [`evals/${stage}-tmp.yaml`]: `version: 1
asOf: '2026-11-23'
stage: ${stage}
cases:
  - id: tmp-case
    stage: ${stage}
    tags: [safety]
    input:
      sourceId: ${sourceId}
      kind: news
      title: Notice from the source
      startsAt: null
      locationText: Pinney Library${assumed}
    expected: ${expected}
    why: A case for the check.
`,
  })
  const run = runCheck(dir)
  return { ok: run.status === 0, out: `${run.stdout}${run.stderr}` }
}

const held = '{ decision: accept, coverage: core, route: reportItem }'
const clean = '{ decision: accept, coverage: core, route: submitSuggestion }'

describe('the eval check and the gate', () => {
  it('passes the real evals', () => {
    const run = runCheck(copyIntelligence())
    expect(run.status, run.stdout + run.stderr).toBe(0)
  })

  it('refuses an accept from an always-held source that expects a suggestion', () => {
    const result = check({ stage: 'curate', sourceId: 'nws-api', expected: clean })
    expect(result.ok).toBe(false)
    expect(result.out).toMatch(/tmp-case.*reportItem/)
  })

  it('wants reportItem for that accept, and a suggestion for one from another source', () => {
    expect(check({ stage: 'curate', sourceId: 'nws-api', expected: held }).ok).toBe(true)
    expect(check({ stage: 'curate', sourceId: 'mpl-pinney-events', expected: clean }).ok).toBe(true)
    expect(check({ stage: 'curate', sourceId: 'mpl-pinney-events', expected: held }).ok).toBe(false)
  })

  it('asks the same of a draft case that expects a suggestion with no decision of its own', () => {
    const draft = (sourceId, given) =>
      check({ stage: 'draft', sourceId, given, expected: '{ route: submitSuggestion }' })
    expect(draft('mpl-pinney-events', 'accept').ok).toBe(true)
    const listed = draft('madison-police-incident-reports', 'accept')
    expect(listed.ok).toBe(false)
    expect(listed.out).toMatch(/tmp-case.*reportItem/)
    const noAccept = draft('mpl-pinney-events', 'needs-review')
    expect(noAccept.ok).toBe(false)
    expect(noAccept.out).toMatch(/tmp-case.*accept/)
  })
})
