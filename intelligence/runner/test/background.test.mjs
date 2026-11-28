import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { backgroundFor, backgroundNote, estimateTokens, newTally } from '../lib/background.mjs'
import { loadContract } from '../lib/contract.mjs'
import { fakeAdapter } from '../lib/model.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { dryRunCms } from '../lib/cms.mjs'
import { robotsChecker } from '../lib/fetchSource.mjs'
import { runStage, runVerify } from '../lib/stages.mjs'
import { curation, feedsHttp, verification } from './fixtures.mjs'
import { contract, contractOn, intelligenceCopy } from './helpers.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// The neighborhood background the model stages are given (#1434): a summary always, a topic note
// only when verify names it, all within one budget in pipeline.yaml, and the run log says what
// went in.

const config = contract.pipeline.background
const background = contract.background
const topic = (id) => background.topics.get(id)
const HEADING = '## Neighborhood background'

/** `background` with its budget set to `maxTokens`. */
const withBudget = (maxTokens) => ({ ...background, maxTokens })

describe('the background settings', () => {
  it('has one budget, in pipeline.yaml, that holds the summary with room for a topic', () => {
    assert.equal(typeof config.maxTokens, 'number')
    assert.ok(background.summary.tokens < config.maxTokens)
    assert.ok(background.summary.tokens + topic('roads-parks-utilities').tokens <= config.maxTokens)
  })

  it('has room for any one topic note with the summary and the list, so one is always given', () => {
    for (const note of background.topics.values())
      assert.ok(
        background.summary.tokens + background.list.tokens + note.tokens <= config.maxTokens,
      )
  })

  it('reads every topic note the settings list', () => {
    assert.deepEqual(
      [...background.topics.keys()],
      config.topics.map((t) => t.id),
    )
  })

  it('counts four characters to a token, rounded up', () => {
    assert.equal(estimateTokens(''), 0)
    assert.equal(estimateTokens('abcd'), 1)
    assert.equal(estimateTokens('abcde'), 2)
  })

  it('refuses to start when the summary alone is over the budget', () => {
    const dir = intelligenceCopy()
    const file = path.join(dir, 'pipeline.yaml')
    writeFileSync(file, readFileSync(file, 'utf8').replace('maxTokens: 2500', 'maxTokens: 200'))
    assert.throws(() => loadContract(dir), /summary.*budget/i)
  })
})

describe('what a stage is given', () => {
  it('is the summary alone for verify and curate when no topic is named', () => {
    for (const stageId of ['verify', 'curate']) {
      const got = backgroundFor(background, stageId, [])
      assert.ok(got.text.includes(background.summary.text.trim().slice(0, 40)))
      assert.deepEqual(got.report.topics, [])
      assert.equal(got.report.tokens, background.summary.tokens + got.listTokens)
    }
  })

  it('is nothing for a stage that is not listed', () => {
    for (const stageId of ['scout', 'draft', 'submit']) {
      const got = backgroundFor(background, stageId, ['land-use'])
      assert.equal(got.text, '')
      assert.equal(got.report, null)
    }
  })

  it('tells the stage which notes exist and what each covers, so verify can name them', () => {
    const { text } = backgroundFor(background, 'verify', [])
    for (const t of config.topics) assert.ok(text.includes(t.id) && text.includes(t.covers))
  })

  it('adds a named topic note, and says so in its report', () => {
    const got = backgroundFor(background, 'curate', ['roads-parks-utilities'])
    assert.ok(got.text.includes(topic('roads-parks-utilities').text.trim().slice(0, 40)))
    assert.deepEqual(
      got.report.topics.map((t) => t.id),
      ['roads-parks-utilities'],
    )
    assert.ok(got.report.tokens <= config.maxTokens)
  })

  it('adds topics in the order named while they fit, and leaves out the one that does not', () => {
    const first = topic('land-use')
    const second = topic('roads-parks-utilities')
    const room = background.summary.tokens + first.tokens + 500
    const got = backgroundFor(withBudget(room), 'curate', [first.id, second.id])
    assert.deepEqual(
      got.report.topics.map((t) => t.id),
      [first.id],
    )
    assert.deepEqual(got.report.skipped, [{ id: second.id, reason: 'over-budget' }])
    assert.ok(got.report.tokens <= room)
    assert.ok(!got.text.includes(second.text.trim().slice(0, 40)))
  })

  it('gives the topic list to verify, which names the notes, and to no other stage', () => {
    assert.ok(
      backgroundFor(background, 'verify', []).text.includes('Detailed notes you can ask for'),
    )
    const curate = backgroundFor(background, 'curate', [])
    assert.ok(!curate.text.includes('Detailed notes you can ask for'))
    for (const t of config.topics) assert.ok(!curate.text.includes(t.covers))
    assert.equal(curate.listTokens, 0)
  })

  it('ignores an unknown or repeated topic id without failing', () => {
    const got = backgroundFor(background, 'curate', ['nope', 'land-use', 'land-use'])
    assert.deepEqual(
      got.report.topics.map((t) => t.id),
      ['land-use'],
    )
    assert.deepEqual(got.report.skipped, [{ id: 'nope', reason: 'unknown' }])
  })
})

describe('the stages’ messages', () => {
  const item = { candidate: { title: 'Meeting on the Milwaukee Street extension' } }
  const messages = []
  const ask = fakeAdapter(({ stageId, message }) => {
    messages.push({ stageId, message })
    return stageId === 'curate' ? curation() : verification()
  })
  const last = (stageId) => messages.filter((m) => m.stageId === stageId).at(-1).message

  it('carries the summary in verify and curate, and none in draft', async () => {
    await runStage(contract, ask, 'verify', item)
    assert.ok(last('verify').includes(HEADING))
    assert.ok(last('verify').includes(background.summary.text.trim().slice(0, 40)))
    await runStage(contract, ask, 'curate', item)
    assert.ok(last('curate').includes(HEADING))
    const { composeMessage } = await import('../lib/model.mjs')
    const draftMessage = composeMessage({
      stageId: 'draft',
      prompt: contract.prompts.draft,
      coverage: contract.coverage,
      schemas: contract.schemas,
      outputSchema: 'schemas/draft.schema.json',
      item,
    })
    assert.ok(!draftMessage.includes(HEADING))
  })

  it('carries a topic note in curate only when verify named it', async () => {
    const named = { ...item, verification: verification({ backgroundTopics: ['land-use'] }) }
    await runStage(contract, ask, 'curate', named)
    assert.ok(last('curate').includes(topic('land-use').text.trim().slice(0, 40)))
    await runStage(contract, ask, 'curate', { ...item, verification: verification() })
    assert.ok(!last('curate').includes(topic('land-use').text.trim().slice(0, 40)))
  })

  it('gives the high-effort verify rerun the topics the first answer named', async () => {
    const seen = []
    const rerun = fakeAdapter(({ message }) => {
      seen.push(message)
      return verification(
        seen.length === 1 ? { confidence: 0.2, backgroundTopics: ['land-use'] } : {},
      )
    })
    await runVerify(contract, rerun, item)
    assert.equal(seen.length, 2)
    assert.ok(!seen[0].includes(topic('land-use').text.trim().slice(0, 40)))
    assert.ok(seen[1].includes(topic('land-use').text.trim().slice(0, 40)))
  })

  it('sends an item to review when verify names more topics than it may', async () => {
    const tooMany = fakeAdapter(() =>
      verification({ backgroundTopics: ['land-use', 'roads-parks-utilities'] }),
    )
    await assert.rejects(runStage(contract, tooMany, 'verify', item), /failed its schema twice/)
  })

  it('accepts one named topic, and none', async () => {
    for (const backgroundTopics of [['land-use'], []]) {
      const ok = fakeAdapter(() => verification({ backgroundTopics }))
      await runStage(contract, ok, 'verify', item)
    }
  })

  it('costs less to send the summary alone than with a topic note', () => {
    const base = backgroundFor(background, 'curate', [])
    const more = backgroundFor(background, 'curate', ['civic-sites-and-amendments'])
    assert.ok(more.report.tokens > base.report.tokens)
  })
})

describe('the run log’s note', () => {
  it('says the summary and each topic used, and what was left out', () => {
    const tally = newTally()
    tally.add('verify', backgroundFor(background, 'verify', []).report)
    tally.add('curate', backgroundFor(background, 'curate', ['land-use', 'nope']).report)
    const note = backgroundNote(tally, config)
    assert.match(note, /^Background: /)
    assert.match(note, /summary/)
    assert.match(note, /land-use/)
    assert.match(note, /nope/)
    assert.match(note, /verify/)
    assert.match(note, /curate/)
  })

  it('says so when no model stage ran', () => {
    assert.match(backgroundNote(newTally(), config), /^Background: no model stage ran/)
  })

  it('is in a whole run’s log without making the run partial', async () => {
    const http = feedsHttp()
    const cms = dryRunCms(null)
    cms.taxonomy = async () => [{ slug: 'community', title: 'Community', parent: null }]
    const ask = fakeAdapter(({ stageId }) =>
      stageId === 'verify'
        ? verification({ backgroundTopics: ['land-use'] })
        : curation({ decision: 'reject', reasons: ['Not about the area.'] }),
    )
    const result = await runPipeline({
      contract: contractOn('2026-10-25'),
      cms,
      ask,
      state: { sources: {}, seen: {} },
      http,
      robots: robotsChecker(http),
      repoCommit: 'a'.repeat(40),
      now: () => new Date('2026-10-25T17:00:00Z'),
    })
    const { log } = result
    const notes = log.errors.filter((e) => e.startsWith('Background: '))
    assert.equal(notes.length, 1)
    assert.match(notes[0], /land-use/)
    assert.equal(log.status, 'succeeded')
    // Returned as a note too, so the console line does not present it as an error
    assert.ok(result.notes.includes(notes[0]))
  })
})
