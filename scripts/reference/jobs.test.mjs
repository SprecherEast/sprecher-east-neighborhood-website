import { describe, expect, it } from 'vitest'

import { describeJobs } from './jobs.mjs'
import { renderJobs } from './jobsPage.mjs'
import { config, extras, locate, retain } from './jobsFixture.mjs'

describe('describeJobs', () => {
  const jobs = describeJobs(config, locate, (file) =>
    file === 'src/modules/a/cms/retention.ts'
      ? [{ collection: 'old-things', operations: ['delete', 'read'] }]
      : [],
  )

  it('describes each task with its schedule, queue, handler file and the collections it reaches', () => {
    expect(jobs.tasks[0]).toMatchObject({
      slug: 'deleteOld',
      label: 'Delete old things',
      schedules: [{ cron: '0 * * * *', words: 'every hour, on the hour', queue: 'retention' }],
      queues: ['retention'],
      file: 'src/modules/a/cms/retention.ts',
      collections: [{ collection: 'old-things', operations: ['delete', 'read'] }],
    })
  })

  it('puts a task nobody schedules in the default queue and marks it as Payload’s own', () => {
    expect(jobs.tasks[1]).toMatchObject({
      slug: 'schedulePublish',
      schedules: [],
      queues: ['default'],
      file: 'payload',
      collections: [],
    })
  })

  it('describes each runner and the tasks in its queue', () => {
    expect(jobs.runners).toEqual([
      {
        cron: '*/10 * * * *',
        words: 'every 10 minutes',
        queue: 'retention',
        limit: '10 (Payload’s default, none is set)',
        schedulingPass: 'yes',
        tasks: ['deleteOld'],
      },
      {
        cron: '* * * * *',
        words: 'every minute',
        queue: 'default',
        limit: '10',
        schedulingPass: 'no',
        tasks: ['schedulePublish'],
      },
    ])
  })

  it('names who may queue and run jobs, in a fixed order, and the endpoint each guards', () => {
    const withRoutes = describeJobs(config, locate, () => [], {
      endpoints: [
        { method: 'GET', path: '/api/payload-jobs/run', guards: 'run' },
        { method: 'GET', path: '/api/payload-jobs/handle-schedules', guards: 'run' },
        { method: 'GET', path: '/api/payload-jobs/count', guards: null },
      ],
    })
    expect(withRoutes.access.map((a) => [a.operation, a.name, a.endpoints])).toEqual([
      ['queue', 'isStaff', []],
      [
        'run',
        'isAdminBoolean',
        ['GET /api/payload-jobs/run', 'GET /api/payload-jobs/handle-schedules'],
      ],
    ])
  })

  it('says the runners are not shown when the config sets them with a function', () => {
    const jobsWithFunction = describeJobs({ ...config, autoRun: () => [] }, locate, () => [])
    expect(jobsWithFunction.runners).toEqual([])
    expect(jobsWithFunction.runnersNote).toMatch(/function/)
    expect(renderJobs(jobsWithFunction, [], extras)).toContain('set by a function')
  })
})
