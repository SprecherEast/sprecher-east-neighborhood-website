import { describe, expect, it } from 'vitest'

import { describeJobs, scheduleHooks, tasksReaching } from './jobs.mjs'
import { renderJobs } from './jobsPage.mjs'

function release() {}
function other() {}
function handlerA() {}
const locate = (fn) =>
  fn === release || fn === other || fn === handlerA ? 'src/platform/payload/hooks.ts' : 'payload'
const hook = { beforeSchedule: release }
const config = {
  tasks: [
    { slug: 'a', handler: handlerA, schedule: [{ cron: '0 * * * *', queue: 'q', hooks: hook }] },
    { slug: 'b', handler: () => 1, schedule: [{ cron: '0 * * * *', queue: 'q', hooks: hook }] },
    {
      slug: 'c',
      handler: () => 1,
      schedule: [{ cron: '5 * * * *', hooks: { afterSchedule: other, bogus: 3 } }],
    },
    { slug: 'd', handler: () => 1, schedule: [{ cron: '6 * * * *' }] },
  ],
  autoRun: [],
  access: {},
}
// What each function reaches: the hook writes `payload-jobs`; the handler of `a` reads `faq`
const filesOf = (file, task, name) =>
  name === 'release'
    ? [{ collection: 'payload-jobs', operations: ['read (access bypassed)'], why: [] }]
    : file === 'payload'
      ? []
      : []
const jobs = describeJobs(config, locate, (file, task, name) =>
  name
    ? filesOf(file, task, name)
    : task === 'a'
      ? [{ collection: 'faq', operations: [], why: [] }]
      : [],
)
const extras = { serverCrons: [], intelligence: null, dependabot: [] }

describe('schedule hooks (#1461)', () => {
  it('reads the function hooks of each schedule, with what each reaches', () => {
    expect(jobs.tasks[0].schedules[0].hooks).toEqual([
      {
        phase: 'beforeSchedule',
        name: 'release',
        file: 'src/platform/payload/hooks.ts',
        collections: [
          { collection: 'payload-jobs', operations: ['read (access bypassed)'], why: [] },
        ],
      },
    ])
    expect(jobs.tasks[3].schedules[0].hooks).toEqual([])
    expect(jobs.tasks[2].schedules[0].hooks.map((h) => h.phase)).toEqual(['afterSchedule'])
  })

  it('lists each hook once, with the tasks that use it, sorted by name', () => {
    expect(scheduleHooks(jobs.tasks).map((h) => [h.name, h.phase, h.tasks])).toEqual([
      ['other', 'afterSchedule', ['c']],
      ['release', 'beforeSchedule', ['a', 'b']],
    ])
  })

  it('counts a task as reaching a collection through its handler or through a hook', () => {
    expect(tasksReaching(jobs.tasks, 'payload-jobs')).toEqual(['a', 'b'])
    expect(tasksReaching(jobs.tasks, 'faq')).toEqual(['a'])
    expect(tasksReaching(jobs.tasks, 'none')).toEqual([])
  })

  it('names the hook in the schedule cell and has a table for the hooks', () => {
    const page = renderJobs(jobs, [], extras)
    expect(page).toContain(
      '`0 * * * *` (every hour, on the hour)<br>`beforeSchedule` hook `release`',
    )
    expect(page).toContain('## Schedule hooks')
    expect(page).toContain(
      '[`payload-jobs`](content-types/payload-jobs.md) (read (access bypassed))',
    )
    const without = renderJobs(
      describeJobs({ ...config, tasks: [config.tasks[3]] }, locate),
      [],
      extras,
    )
    expect(without).not.toContain('## Schedule hooks')
  })
})
