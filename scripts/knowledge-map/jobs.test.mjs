import { describe, expect, it } from 'vitest'

import { buildJobs } from './jobs.mjs'

const scheduled = {
  jobs: {
    tasks: [
      {
        slug: 'deleteExpiredContactMessages',
        label: 'Delete expired contact messages',
        schedules: [
          {
            cron: '0 * * * *',
            words: 'every hour, on the hour',
            queue: 'retention',
            hooks: [
              {
                phase: 'beforeSchedule',
                name: 'releaseStuckJobs',
                file: 'src/platform/payload/retentionJobs.ts',
                collections: [],
              },
            ],
          },
        ],
        queues: ['retention'],
        file: 'src/modules/contact/cms/retention.ts',
        collections: [
          {
            collection: 'form-submissions',
            operations: ['delete (access bypassed)', 'read (access bypassed)'],
            why: [],
          },
          { collection: 'forms', operations: ['read (access bypassed)'], why: [] },
        ],
      },
      {
        slug: 'schedulePublish',
        label: '',
        schedules: [],
        queues: ['default'],
        file: 'payload',
        collections: [],
      },
    ],
    runners: [
      {
        cron: '*/10 * * * *',
        words: 'every 10 minutes',
        queue: 'retention',
        limit: '10',
        schedulingPass: 'yes',
        tasks: ['deleteExpiredContactMessages'],
      },
      {
        cron: '* * * * *',
        words: 'every minute',
        queue: 'default',
        limit: '10',
        schedulingPass: 'no',
        tasks: ['schedulePublish'],
      },
    ],
  },
}
const contentTypeIds = ['collection:form-submissions', 'collection:forms']
const ownerOf = (file) =>
  file.startsWith('src/modules/contact/') ? { id: 'module:contact', top: 'module:contact' } : null

describe('buildJobs', () => {
  const { nodes, edges } = buildJobs({
    scheduled,
    contentTypeIds,
    ownerOf,
    payloadId: 'platform-area:payload',
  })
  const byId = (id) => nodes.find((n) => n.id === id)
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a job of each task, at its handler file, held by the module that wrote it', () => {
    expect(byId('job:deleteExpiredContactMessages')).toMatchObject({
      type: 'job',
      name: 'deleteExpiredContactMessages',
      summary: 'Delete expired contact messages',
      path: 'src/modules/contact/cms/retention.ts',
      module: 'module:contact',
    })
    expect(edge('module:contact', 'job:deleteExpiredContactMessages', 'contains')).toBeDefined()
  })

  it('puts a task Payload makes under Payload, at the generated jobs page', () => {
    expect(byId('job:schedulePublish')).toMatchObject({
      path: 'docs/reference/jobs.md',
      module: 'platform-area:payload',
    })
  })

  it('states when and where a job runs', () => {
    const facts = Object.fromEntries(
      byId('job:deleteExpiredContactMessages').facts.map((f) => [f.label, f.value]),
    )
    expect(facts.Schedule).toBe('0 * * * * (every hour, on the hour)')
    expect(facts.Queue).toBe('retention')
    expect(facts.Runner).toBe('*/10 * * * * (every 10 minutes), up to 10 per run')
    expect(facts['Before it is queued']).toBe(
      'releaseStuckJobs (src/platform/payload/retentionJobs.ts)',
    )
  })

  it('has a job read and write the content types it reaches', () => {
    expect(
      edge('job:deleteExpiredContactMessages', 'collection:form-submissions', 'writes'),
    ).toMatchObject({ via: ['delete (access bypassed)'] })
    expect(
      edge('job:deleteExpiredContactMessages', 'collection:form-submissions', 'reads'),
    ).toBeDefined()
    expect(edge('job:deleteExpiredContactMessages', 'collection:forms', 'reads')).toBeDefined()
  })
})
