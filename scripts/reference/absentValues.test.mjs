/** What the generator says when the config or a file leaves a value out (#1461). */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { describeInput, typeOf } from './inputSchema.mjs'
import { describeJobs } from './jobs.mjs'
import {
  SERVER_SCRIPTS,
  WORKFLOW_FILES,
  filesIn,
  graphQLRules,
  graphQLSettings,
  ownerText,
} from './loadFacts.mjs'
import { describeMcp } from './mcpTools.mjs'
import { parseDependabot, parseIntelligenceSchedule, parseTimedWorkflows } from './timers.mjs'

describe('input schemas with values left out', () => {
  it('says "any" for a schema with no type, and has no fields for one with no properties', () => {
    expect(typeOf({})).toBe('any')
    expect(describeInput({ type: 'object' })).toEqual([])
    expect(describeInput({ properties: { a: {} } })).toEqual([
      { name: 'a', type: 'any', required: 'no', note: '' },
    ])
  })

  it('marks every field of an object with no required list as optional', () => {
    const items = { type: 'object', properties: { x: { type: 'string' } } }
    const [field] = describeInput({ properties: { list: { type: 'array', items } } })
    expect(field.note).toContain('`x` (string, optional)')
  })
})

describe('jobs with values left out', () => {
  const locate = () => 'payload'
  const jobs = describeJobs(
    {
      tasks: [{ slug: 'a', handler: () => 1, schedule: [{ cron: '* * * * *' }] }],
      autoRun: [{ cron: '*/5 * * * *' }],
      access: {},
    },
    locate,
    () => [],
  )

  it('puts a schedule and a runner with no queue in the default queue', () => {
    expect(jobs.tasks[0].schedules[0].queue).toBe('default')
    expect(jobs.tasks[0].queues).toEqual(['default'])
    expect(jobs.runners[0]).toMatchObject({ queue: 'default', tasks: ['a'] })
  })
})

describe('AI agent tools with values left out', () => {
  const none = describeMcp({}, { schemaOf: () => ({}) })

  it('has no server name, tools or custom tools when the options leave them out', () => {
    expect(none.server).toBe('')
    expect(none.collectionTools).toEqual([])
    expect(none.customTools).toEqual([])
  })

  it('gives a tool of a content type with no description an empty one', () => {
    const found = describeMcp(
      { collections: { events: { enabled: { find: true } } } },
      { schemaOf: () => ({}) },
    )
    expect(found.collectionTools[0].description).toBe('')
  })
})

describe('timers with values left out', () => {
  it('lists a timed workflow with no jobs as having none', () => {
    const text = "on:\n  schedule:\n    - cron: '1 * * * *'\n"
    expect(parseTimedWorkflows([{ file: '.github/workflows/x.yml', text }])[0].jobs).toEqual([])
  })

  it('gives an empty time zone and no Dependabot entries when the files leave them out', () => {
    const settings = parseIntelligenceSchedule({
      file: 'a.yaml',
      text: "schedule:\n  cron: '1 * * * *'\n",
    })
    expect(settings).toEqual({ file: 'a.yaml', cron: '1 * * * *', timezone: '' })
    expect(parseDependabot({ file: 'd.yml', text: 'version: 2\n' })).toEqual([])
  })
})

describe('ownerText with values left out', () => {
  const model = {
    slug: 'events',
    access: [],
    hooks: [],
    // a field row that carries no hooks
    fields: [{}],
    allEndpoints: [{ file: '@payloadcms/plugin-x' }],
  }

  it('names the plugin alone when no module configures it, and reads a field with no hooks', () => {
    expect(ownerText(model, new Map(), new Map(), '/none')).toEqual({
      owner: 'the plugin `@payloadcms/plugin-x`',
      file: '',
      plugin: '@payloadcms/plugin-x',
      modules: [],
    })
  })
})

describe('graphQLRules', () => {
  const rule = () => 1
  const rulesOf = (validationRules) => graphQLRules({ graphQL: { validationRules } })

  it('lists what the config function returns, and none when it gives nothing or fails', () => {
    expect(rulesOf(() => [rule])).toEqual([rule])
    expect(rulesOf((request) => (typeof request === 'object' ? [rule] : []))).toEqual([rule])
    expect(rulesOf(undefined)).toEqual([])
    expect(rulesOf(() => undefined)).toEqual([])
    expect(
      rulesOf(() => {
        throw new Error('needs a request')
      }),
    ).toEqual([])
  })
})

describe('graphQLSettings', () => {
  it('keeps the limits the config sets, and leaves out the ones it does not', () => {
    expect(
      graphQLSettings({
        graphQL: { maxComplexity: 5, disablePlaygroundInProduction: false, path: '/x' },
      }),
    ).toStrictEqual({ maxComplexity: 5, disablePlaygroundInProduction: false })
    expect(graphQLSettings({ graphQL: {} })).toStrictEqual({})
  })
})

describe('the file types and the folder listing of the loader', () => {
  it('takes only a whole `.yml` or `.yaml` workflow name, and only a `.sh` script', () => {
    expect(['a.yml', 'a.yaml'].map((n) => WORKFLOW_FILES.test(n))).toEqual([true, true])
    expect(['a.yml.bak', 'ayml', 'a.yamlx'].map((n) => WORKFLOW_FILES.test(n))).toEqual([
      false,
      false,
      false,
    ])
    expect(['a.sh', 'dir.sh'].map((n) => SERVER_SCRIPTS.test(n))).toEqual([true, true])
    expect(['a.sh.orig', 'ash', 'a.shx'].map((n) => SERVER_SCRIPTS.test(n))).toEqual([
      false,
      false,
      false,
    ])
  })

  it('lists the files of a folder that match, sorted by name, whatever order the disk gives', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-files-in-'))
    fs.mkdirSync(path.join(root, 'ops'))
    for (const name of ['b.sh', 'a.sh', 'c.txt'])
      fs.writeFileSync(path.join(root, 'ops', name), name)
    const spy = vi.spyOn(fs, 'readdirSync').mockReturnValue(['b.sh', 'c.txt', 'a.sh'])
    try {
      expect(filesIn(root, 'ops', SERVER_SCRIPTS)).toEqual([
        { file: 'ops/a.sh', text: 'a.sh' },
        { file: 'ops/b.sh', text: 'b.sh' },
      ])
    } finally {
      spy.mockRestore()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
