import { describe, expect, it } from 'vitest'

import { buildScheduledTasks, parseScheduledPage } from './scheduled.mjs'

const PAGE = `# Scheduled tasks outside the repository

Intro text.

## Weekday neighborhood scout

- **Runs:** on weekdays, in the early evening, Central time.
- **Instructions:** the schedule's own prompt points at the repository
  for how to work, so the run rules are kept there.
- **May not:** write anything outside its own report.

## Not covered here

- The server's own cron job is on the generated jobs page.
`

describe('parseScheduledPage', () => {
  it('reads each task section as a name and its labelled facts, and stops at "Not covered here"', () => {
    expect(parseScheduledPage(PAGE)).toEqual([
      {
        name: 'Weekday neighborhood scout',
        facts: [
          { label: 'Runs', value: 'on weekdays, in the early evening, Central time.' },
          {
            label: 'Instructions',
            value:
              "the schedule's own prompt points at the repository for how to work, so the run rules are kept there.",
          },
          { label: 'May not', value: 'write anything outside its own report.' },
        ],
      },
    ])
  })
})

describe('buildScheduledTasks', () => {
  const extras = {
    serverCrons: [
      {
        file: 'ops/install-cron.sh',
        cron: '15 8 * * *',
        runs: ['ops/backup.sh daily', 'ops/backup-umami.sh daily'],
      },
    ],
    intelligence: {
      file: 'intelligence/pipeline.yaml',
      cron: '40 6 * * *',
      timezone: 'America/Chicago',
    },
    dependabot: [
      {
        file: '.github/dependabot.yml',
        ecosystem: 'npm',
        directory: '/',
        when: 'weekly on monday',
      },
      {
        file: '.github/dependabot.yml',
        ecosystem: 'github-actions',
        directory: '/',
        when: 'weekly on monday',
      },
    ],
  }
  const { nodes, edges } = buildScheduledTasks({
    page: { path: 'docs/knowledge/scheduled-tasks.md', text: PAGE },
    extras,
    groupId: 'group:scheduled-tasks',
  })
  const byId = (id) => nodes.find((n) => n.id === id)

  it('makes a node of each task on the page, at the page', () => {
    expect(byId('scheduled-task:weekday-neighborhood-scout')).toMatchObject({
      type: 'scheduled-task',
      name: 'Weekday neighborhood scout',
      path: 'docs/knowledge/scheduled-tasks.md',
    })
  })

  it('makes a node of the server cron, the intelligence pipeline and the dependency updates', () => {
    expect(byId('scheduled-task:server-cron-install-cron').facts).toContainEqual({
      label: 'Runs',
      value: 'ops/backup.sh daily; ops/backup-umami.sh daily',
    })
    expect(byId('scheduled-task:intelligence-pipeline')).toMatchObject({
      path: 'intelligence/pipeline.yaml',
    })
    expect(byId('scheduled-task:dependabot').facts).toEqual([
      { label: 'npm /', value: 'weekly on monday' },
      { label: 'github-actions /', value: 'weekly on monday' },
    ])
  })

  it('holds every task in the group', () => {
    expect(
      edges.filter((e) => e.type === 'contains' && e.from === 'group:scheduled-tasks'),
    ).toHaveLength(4)
  })
})

describe('buildScheduledTasks: several server crons', () => {
  const extras = {
    serverCrons: [
      { file: 'ops/install-cron.sh', cron: '15 8 * * *', runs: ['ops/backup.sh daily'] },
      { file: 'ops/install-cron.sh', cron: '45 8 * * *', runs: ['ops/other.sh'] },
      {
        file: 'ops/install-offsite-backup.sh',
        cron: '30 9 * * 0',
        runs: ['ops/offsite-backup.sh run'],
      },
    ],
    intelligence: null,
    dependabot: [],
  }
  const { nodes } = buildScheduledTasks({
    page: { path: 'docs/knowledge/scheduled-tasks.md', text: '# T\n' },
    extras,
    groupId: 'group:scheduled-tasks',
  })

  it('gives every cron line its own node, with an id that differs between scripts and between lines of one script', () => {
    const ids = nodes.map((n) => n.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual([
      'scheduled-task:server-cron-install-cron',
      'scheduled-task:server-cron-install-cron-2',
      'scheduled-task:server-cron-install-offsite-backup',
    ])
  })
})
