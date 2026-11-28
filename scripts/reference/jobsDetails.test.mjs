import { describe, expect, it } from 'vitest'

import { describeJobs, scheduleHooks } from './jobs.mjs'

const hook = (file, name, phase = 'beforeSchedule') => ({ file, name, phase, collections: [] })
const task = (slug, ...hooks) => ({ slug, schedules: [{ hooks }] })

describe('describeJobs details (#1461)', () => {
  it('lists the access functions as the jobs setting orders them: queue, run, cancel', () => {
    const access = { cancel: () => true, run: () => true, queue: () => true }
    expect(describeJobs({ access }).access.map((entry) => entry.operation)).toEqual([
      'queue',
      'run',
      'cancel',
    ])
  })

  it('lists only the access settings that are functions', () => {
    const access = { queue: () => true, run: true, cancel: 'yes', zeta: undefined }
    expect(describeJobs({ access }).access.map((entry) => entry.operation)).toEqual(['queue'])
  })

  it('puts an access name the setting does not list after the listed ones, by name', () => {
    const access = { cancel: () => true, zeta: () => true, another: () => true, queue: () => true }
    expect(describeJobs({ access }).access.map((entry) => entry.operation)).toEqual([
      'queue',
      'cancel',
      'another',
      'zeta',
    ])
  })

  it('says why no runners are shown when a function sets them', () => {
    expect(describeJobs({ autoRun: () => [] })).toMatchObject({
      runners: [],
      runnersNote: 'The runners are set by a function in the config, so they are not shown here.',
    })
    expect(describeJobs({ autoRun: [] }).runnersNote).toBe('')
  })
})

describe('describeJobs names and arguments (#1461)', () => {
  const handler = () => {}

  it('calls a function written under its own key inline, in an access setting and in a hook', () => {
    const jobs = describeJobs({
      tasks: [
        {
          slug: 't',
          handler,
          schedule: [{ cron: '* * * * *', hooks: { beforeSchedule: () => {} } }],
        },
      ],
      access: { run: () => {}, cancel: function named() {} },
    })
    expect(jobs.tasks[0].schedules[0].hooks.map((h) => h.name)).toEqual(['inline'])
    expect(jobs.access.map((entry) => [entry.operation, entry.name])).toEqual([
      ['run', 'inline'],
      ['cancel', 'named'],
    ])
  })

  it('asks for the collections of a handler by its file and the task, of a hook by file, task and name', () => {
    const asked = []
    const hookFn = function hookName() {}
    const locate = (fn) => (fn === hookFn ? 'src/hook.ts' : 'src/handler.ts')
    describeJobs(
      {
        tasks: [
          { slug: 'taskSlug', handler, schedule: [{ cron: '* * * * *', hooks: { x: hookFn } }] },
        ],
      },
      locate,
      (...args) => {
        asked.push(args)
        return []
      },
    )
    expect(asked).toEqual([
      ['src/hook.ts', 'taskSlug', 'hookName'],
      ['src/handler.ts', 'taskSlug'],
    ])
  })
})

describe('scheduleHooks', () => {
  it('sorts by name first and by file when two hooks have the same name', () => {
    const found = scheduleHooks([
      task(
        't',
        hook('a/late.ts', 'b'),
        hook('z.ts', 'a'),
        hook('z.ts', 'same'),
        hook('a.ts', 'same'),
      ),
    ])
    // name decides: `a` (file z) before `b` (file a/late); file decides between the two `same`
    expect(found.map((entry) => [entry.name, entry.file])).toEqual([
      ['a', 'z.ts'],
      ['b', 'a/late.ts'],
      ['same', 'a.ts'],
      ['same', 'z.ts'],
    ])
  })

  it('lists a hook once with every task that uses it, and keeps hooks that differ apart', () => {
    const found = scheduleHooks([
      task('first', hook('a', 'bc'), hook('a', 'bc', 'afterSchedule')),
      task('second', hook('a', 'bc'), hook('ab', 'c')),
      task('second', hook('a', 'bc')),
    ])
    expect(found.map((entry) => [entry.file, entry.name, entry.phase, entry.tasks])).toEqual([
      ['a', 'bc', 'beforeSchedule', ['first', 'second']],
      ['a', 'bc', 'afterSchedule', ['first']],
      ['ab', 'c', 'beforeSchedule', ['second']],
    ])
  })
})
