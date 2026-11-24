import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'

import { intelligenceCopy, intelligenceDir } from './helpers.mjs'

// The eval check (scripts/check-intelligence.mjs) asks the same rules as the gate where an eval
// case expects an item to go (#1007). The logic itself is tested in
// scripts/check-intelligence-routes.test.mjs; these run the script on a copy of the evals.

const script = path.join(intelligenceDir, '..', 'scripts', 'check-intelligence.mjs')

function check(dir) {
  const run = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' })
  return { ok: run.status === 0, out: `${run.stdout}${run.stderr}` }
}

/** A copy of intelligence/ with one more eval case for `stage`; `given` is the curation decision it assumes. */
function withCase({ stage, sourceId, given = null, expected }) {
  const assumed = given
    ? `\n    given:\n      curation: { decision: ${given}, audiences: [everyone] }`
    : ''
  return intelligenceCopy({
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
}

describe('the eval check and the gate', () => {
  it('passes the real evals', () => {
    const result = check(intelligenceDir)
    assert.equal(result.ok, true, result.out)
  })

  it('refuses an accept from an always-held source that expects a suggestion', () => {
    const expected = '{ decision: accept, coverage: core, route: submitSuggestion }'
    const result = check(withCase({ stage: 'curate', sourceId: 'nws-api', expected }))
    assert.equal(result.ok, false)
    assert.match(result.out, /tmp-case.*reportItem/)
  })

  it('wants reportItem for that accept, and a suggestion for one from another source', () => {
    const held = '{ decision: accept, coverage: core, route: reportItem }'
    const clean = '{ decision: accept, coverage: core, route: submitSuggestion }'
    assert.equal(check(withCase({ stage: 'curate', sourceId: 'nws-api', expected: held })).ok, true)
    assert.equal(
      check(withCase({ stage: 'curate', sourceId: 'mpl-pinney-events', expected: clean })).ok,
      true,
    )
    assert.equal(
      check(withCase({ stage: 'curate', sourceId: 'mpl-pinney-events', expected: held })).ok,
      false,
    )
  })

  it('asks the same of a draft case that expects a suggestion with no decision of its own', () => {
    const suggest = '{ route: submitSuggestion }'
    const draft = (sourceId, given) =>
      withCase({ stage: 'draft', sourceId, given, expected: suggest })
    assert.equal(check(draft('mpl-pinney-events', 'accept')).ok, true)
    const listed = check(draft('madison-police-incident-reports', 'accept'))
    assert.equal(listed.ok, false)
    assert.match(listed.out, /tmp-case.*reportItem/)
    const noAccept = check(draft('mpl-pinney-events', 'needs-review'))
    assert.equal(noAccept.ok, false)
    assert.match(noAccept.out, /tmp-case.*accept/)
  })
})
