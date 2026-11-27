import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { cmsOperations, withoutSuggestions } from '../lib/cms.mjs'
import { intelligenceDir } from './helpers.mjs'
import { cmsWithLog, runId } from './safetyHelpers.mjs'

// The client every module but submit gets (#1007).

describe('the client every other module gets cannot suggest', () => {
  const real = cmsWithLog()
  const client = withoutSuggestions(real)

  it('keeps the operations the run needs, and nothing else', () => {
    for (const name of ['taxonomy', 'known', 'createRun', 'updateRun', 'reportItem']) {
      assert.equal(typeof client[name], 'function', name)
    }
    assert.deepEqual(
      Object.keys(client).filter((key) => /submit|call|tool/i.test(key)),
      [],
    )
  })

  const spellings = {
    dot: (c) => c.submitSuggestion({}),
    bracket: (c) => c['submitSuggestion']({}),
    computed: (c) => c[['submit', 'Suggestion'].join('')]({}),
    optional: (c) => c.submitSuggestion?.({}) ?? Promise.reject(new Error('absent')),
    destructured: (c) => {
      const { submitSuggestion } = c
      return submitSuggestion({})
    },
    call: (c) => c.submitSuggestion.call(c, {}),
    apply: (c) => Reflect.apply(c.submitSuggestion, c, [{}]),
    callTool: (c) => c.callTool('submitSuggestion', {}),
    spread: (c) => ({ ...c }).submitSuggestion({}),
    lowercase: (c) => c.submitsuggestion({}),
  }
  for (const [name, attempt] of Object.entries(spellings)) {
    it(`throws or finds nothing by ${name}`, async () => {
      await assert.rejects(async () => attempt(client))
      assert.deepEqual(real.submitted, [])
    })
  }

  it('still reaches the real client through the wrapped read and report operations', async () => {
    await client.reportItem({ runId })
    assert.equal(real.writes.at(-1).tool, 'reportItem')
    await client.close()
  })

  it('holds exactly the run’s operations, and the raw tool caller is not among the real ones', () => {
    assert.deepEqual(Object.keys(client).sort(), [
      'close',
      'createRun',
      'known',
      'reportItem',
      'taxonomy',
      'upcomingEvents',
      'updateRun',
    ])
    const operations = cmsOperations(async () => ({ text: '', isError: false }))
    assert.deepEqual(Object.keys(operations).sort(), [
      'createRun',
      'known',
      'reportItem',
      'submitSuggestion',
      'taxonomy',
      'upcomingEvents',
      'updateRun',
    ])
  })

  it('is the only client the run hands out: no module but submit gets the real one', () => {
    const lib = path.join(intelligenceDir, 'runner', 'lib')
    const files = (dir) =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name)
        return statSync(full).isDirectory() ? files(full) : [full]
      })
    const own = (name) => path.basename(name)
    const sources = [...files(lib), path.join(intelligenceDir, 'runner', 'run.mjs')]
      .filter((file) => file.endsWith('.mjs'))
      .map((file) => [own(file), readFileSync(file, 'utf8')])
    const mentioning = (pattern) =>
      sources
        .filter(([, text]) => pattern.test(text))
        .map(([name]) => name)
        .sort()
    assert.deepEqual(mentioning(/submitSuggestion/), ['cms.mjs', 'gate.mjs', 'submit.mjs'])
    assert.deepEqual(mentioning(/callTool/), ['cms.mjs'])
    // The real client is held in one place, pipeline.mjs: it wraps the rest of the run and binds it
    // into a function that only runs submitItem. No other module is handed it.
    const text = (name) => sources.find(([own]) => own === name)[1]
    assert.deepEqual(mentioning(/suggestingCms/), ['pipeline.mjs'])
    assert.match(text('pipeline.mjs'), /cms = withoutSuggestions\(suggestingCms\)/)
    assert.match(
      text('pipeline.mjs'),
      /submitItem\(item, \{ \.\.\.options, cms: suggestingCms, contract \}\)/,
    )
    // Of its uses, none is in the call that starts processing: that gets the wrapped client and `submit`
    const pipelineText = text('pipeline.mjs')
    const call = pipelineText.slice(pipelineText.indexOf('processRun({'))
    assert.doesNotMatch(call.slice(0, call.indexOf('})')), /suggestingCms/)
    assert.match(call, /^processRun\(\{\s+contract,\s+cms,\s+submit,/)
    const submit = sources.find(([name]) => name === 'submit.mjs')[1]
    assert.ok(submit.indexOf('gateItem(') < submit.indexOf('.submitSuggestion('))
    assert.deepEqual(mentioning(/routes\b/), ['gate.mjs'])
  })
})
