import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadContract } from '../lib/contract.mjs'
import { intelligenceCopy } from './helpers.mjs'

// The runner refuses to start on a bad safety setting (#1007).

describe('the settings are checked when the runner starts', () => {
  const copyWith = (file, change) => intelligenceCopy({ [file]: change })

  it('loads the real settings', () => {
    assert.doesNotThrow(() => loadContract(copyWith('pipeline.yaml', (text) => text)))
  })

  it('refuses a pipeline.yaml that routes a held decision to a suggestion', () => {
    const dir = copyWith('pipeline.yaml', (text) =>
      text.replace('needs-review: reportItem', 'needs-review: submitSuggestion'),
    )
    assert.throws(() => loadContract(dir), /pipeline\.yaml/)
  })

  it('refuses a pipeline.yaml that points at another safety file', () => {
    const dir = copyWith('pipeline.yaml', (text) =>
      text.replace('safety: safety.yaml', 'safety: area.yaml'),
    )
    assert.throws(() => loadContract(dir), /pipeline\.yaml/)
  })

  it('refuses a safety source id that names no registered source', () => {
    const dir = copyWith('safety.yaml', (text) => `${text.trimEnd()}\n  - no-such-source\n`)
    assert.throws(() => loadContract(dir), /no-such-source|safety\.yaml/)
  })

  it('refuses a safety.yaml with no sources, which would switch the strongest layer off', () => {
    const dir = copyWith('safety.yaml', (text) =>
      text.replace(/\nsources:[\s\S]*$/, '\nsources: []\n'),
    )
    assert.throws(() => loadContract(dir), /safety\.yaml/)
  })

  it('refuses a safety.yaml with no meaning, the principle the stages apply', () => {
    const dir = copyWith('safety.yaml', (text) =>
      text.replace(/^meaning:[\s\S]*?(?=^sources:)/m, ''),
    )
    assert.throws(() => loadContract(dir), /safety\.yaml/)
  })
})
