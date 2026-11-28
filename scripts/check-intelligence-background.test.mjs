import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'

import { backgroundChecks, backgroundProblems } from './check-intelligence-background.mjs'

const config = {
  stages: ['verify', 'curate'],
  topics: [{ id: 'land-use' }, { id: 'roads' }],
}
const input = { sourceId: 'news', title: 'A road claim' }
const base = (id, extra = {}) => ({
  id,
  stage: 'curate',
  input,
  expected: { decision: 'accept' },
  ...extra,
})
const pair = () => [
  base('road-without-background', { background: { summary: false } }),
  base('road-with-background', {
    background: { summary: true, topics: ['roads'] },
    expected: { decision: 'needs-review' },
  }),
]

describe('backgroundProblems', () => {
  it('passes a with and without pair that differ in the result', () => {
    expect(backgroundProblems(pair(), config)).toEqual([])
  })

  it('passes cases that name no background', () => {
    expect(backgroundProblems([base('plain')], config)).toEqual([])
  })

  it('refuses a topic the settings do not list', () => {
    const [without, withIt] = pair()
    withIt.background.topics = ['nope']
    expect(backgroundProblems([without, withIt], config)).toEqual([
      expect.stringContaining('road-with-background: background topic nope'),
    ])
  })

  it('refuses topic notes without the summary', () => {
    const [without, withIt] = pair()
    withIt.background.summary = false
    expect(backgroundProblems([without, withIt], config).join()).toMatch(/needs the summary/)
  })

  it('refuses background on a stage that is not given any', () => {
    const [without, withIt] = pair()
    withIt.stage = 'draft'
    expect(backgroundProblems([without, withIt], config).join()).toMatch(/draft is not given/)
  })

  it('wants every without case to have its with case', () => {
    expect(backgroundProblems([pair()[0]], config).join()).toMatch(/road-with-background/)
    expect(backgroundProblems([pair()[1]], config).join()).toMatch(/road-without-background/)
  })

  it('wants the pair to take the same input and reach a different result', () => {
    const [without, withIt] = pair()
    expect(
      backgroundProblems(
        [without, { ...withIt, input: { ...input, title: 'Other' } }],
        config,
      ).join(),
    ).toMatch(/same input/)
    expect(
      backgroundProblems([without, { ...withIt, expected: without.expected }], config).join(),
    ).toMatch(/different result/)
  })

  it('wants the without case to carry no background, and the with case to carry some', () => {
    const [without, withIt] = pair()
    expect(
      backgroundProblems([{ ...without, background: { summary: true } }, withIt], config).join(),
    ).toMatch(/without-background.*no summary/)
    expect(
      backgroundProblems([without, { ...withIt, background: { summary: false } }], config).join(),
    ).toMatch(/with-background.*summary/)
  })
})

describe('backgroundChecks', () => {
  const dir = fileURLToPath(new URL('../intelligence', import.meta.url))
  const pipeline = yaml.load(readFileSync(`${dir}/pipeline.yaml`, 'utf8'))

  it('passes the real settings and cases', () => {
    expect(backgroundChecks(dir, [], pipeline)).toEqual([])
  })

  it('has nothing to check when the pipeline sets no background', () => {
    expect(backgroundChecks(dir, [], {})).toEqual([])
  })

  it('names pipeline.yaml when the files are over the budget', () => {
    const tight = { ...pipeline, background: { ...pipeline.background, maxTokens: 10 } }
    const [[file, message]] = backgroundChecks(dir, [], tight)
    expect(file).toMatch(/pipeline\.yaml$/)
    expect(message).toMatch(/over the budget/)
  })

  it('reports the cases’ problems against the evals folder', () => {
    const [[file, message]] = backgroundChecks(
      dir,
      [base('lonely-with-background', { background: { summary: true } })],
      pipeline,
    )
    expect(file).toMatch(/evals$/)
    expect(message).toMatch(/lonely-without-background/)
  })
})
