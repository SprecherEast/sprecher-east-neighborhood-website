import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { intelligenceDir } from './helpers.mjs'

// The eval check (scripts/check-intelligence.mjs) asks the same safety rules as the gate where an
// eval case expects an accept to go (#1007).

const script = path.join(intelligenceDir, '..', 'scripts', 'check-intelligence.mjs')

function check(dir) {
  const run = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' })
  return { ok: run.status === 0, out: `${run.stdout}${run.stderr}` }
}

/** A copy of intelligence/ (without the runner) with one more eval file. */
function withCase(route, title) {
  const dir = mkdtempSync(path.join(tmpdir(), 'intel-'))
  cpSync(intelligenceDir, dir, {
    recursive: true,
    filter: (source) =>
      !/^(runner|node_modules)(\/|$)/.test(path.relative(intelligenceDir, source)),
  })
  writeFileSync(
    path.join(dir, 'evals', 'curate-tmp.yaml'),
    `version: 1
asOf: '2026-11-23'
stage: curate
cases:
  - id: tmp-case
    stage: curate
    tags: [safety]
    input:
      sourceId: mpl-pinney-events
      kind: event
      title: ${title}
      startsAt: null
      locationText: Pinney Library
    expected: { decision: accept, coverage: core, route: ${route} }
    why: A case for the check.
`,
  )
  return dir
}

describe('the eval check and the gate', () => {
  it('passes the real evals', () => {
    const result = check(intelligenceDir)
    assert.equal(result.ok, true, result.out)
  })

  it('refuses an accept the gate would hold when it expects a suggestion', () => {
    const result = check(withCase('submitSuggestion', 'Free flu shots at the library'))
    assert.equal(result.ok, false)
    assert.match(result.out, /tmp-case.*reportItem/)
  })

  it('wants reportItem for that accept, and a suggestion for a clean one', () => {
    assert.equal(check(withCase('reportItem', 'Free flu shots at the library')).ok, true)
    assert.equal(check(withCase('submitSuggestion', 'Story hour at the library')).ok, true)
    assert.equal(check(withCase('reportItem', 'Story hour at the library')).ok, false)
  })
})

describe('the eval check for a case that expects a suggestion without a decision', () => {
  /** A draft-stage case: the given curation decision, the title, the route it expects, and a given draft body if any. */
  function draftCase(decision, title, route, body = null) {
    const dir = mkdtempSync(path.join(tmpdir(), 'intel-'))
    cpSync(intelligenceDir, dir, {
      recursive: true,
      filter: (source) =>
        !/^(runner|node_modules)(\/|$)/.test(path.relative(intelligenceDir, source)),
    })
    writeFileSync(
      path.join(dir, 'evals', 'draft-tmp.yaml'),
      `version: 1
asOf: '2026-11-23'
stage: draft
cases:
  - id: tmp-draft
    stage: draft
    tags: [editorial]
    input:
      sourceId: mpl-pinney-events
      kind: news
      title: ${title}
      startsAt: null
      locationText: Pinney Library
    given:
      curation: { decision: ${decision}, audiences: [everyone] }${
        body === null
          ? ''
          : `
      draft: { collection: events, title: Library hour, bodyMarkdown: ${body}, audience: [everyone] }`
      }
    expected: { route: ${route} }
    why: A case for the check.
`,
    )
    return dir
  }

  it('refuses a suggestion for anything but an accept', () => {
    const result = check(draftCase('needs-review', 'Story hour at the library', 'submitSuggestion'))
    assert.equal(result.ok, false)
    assert.match(result.out, /tmp-draft.*accept/)
  })

  it('refuses a suggestion for an accept the gate would hold', () => {
    const result = check(draftCase('accept', 'Police report from the library', 'submitSuggestion'))
    assert.equal(result.ok, false)
    assert.match(result.out, /tmp-draft.*reportItem/)
  })

  it('accepts a clean accept as a suggestion and a held one as a report', () => {
    assert.equal(
      check(draftCase('accept', 'Story hour at the library', 'submitSuggestion')).ok,
      true,
    )
    assert.equal(
      check(draftCase('accept', 'Police report from the library', 'reportItem')).ok,
      true,
    )
  })

  it('reads the given draft, not only the input', () => {
    const held = check(
      draftCase('accept', 'Story hour at the library', 'submitSuggestion', 'Police were called'),
    )
    assert.equal(held.ok, false)
    assert.match(held.out, /tmp-draft.*reportItem/)
    assert.equal(
      check(draftCase('accept', 'Story hour at the library', 'submitSuggestion', 'Bring a book'))
        .ok,
      true,
    )
  })
})
