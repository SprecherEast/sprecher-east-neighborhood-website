import { describe, expect, it } from 'vitest'

import {
  parseDependabot,
  parseIntelligenceSchedule,
  parseServerCrons,
  parseTimedWorkflows,
} from './timers.mjs'

describe('parseTimedWorkflows', () => {
  const timed = `
name: Nightly check
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'
jobs:
  audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
  build:
    runs-on: ubuntu-latest
`
  const untimed = 'name: Build\non:\n  pull_request:\njobs:\n  a:\n    runs-on: x\n'

  it('lists a workflow with a schedule, its cron lines and its jobs by name', () => {
    expect(
      parseTimedWorkflows([
        { file: '.github/workflows/nightly.yml', text: timed },
        { file: '.github/workflows/build.yml', text: untimed },
      ]),
    ).toEqual([
      {
        file: '.github/workflows/nightly.yml',
        name: 'Nightly check',
        crons: ['0 6 * * *'],
        jobs: ['Dependency Audit', 'build'],
      },
    ])
  })

  it('leaves out a workflow whose schedule is empty', () => {
    const text = 'name: X\non:\n  schedule: []\njobs:\n  a: {}\n'
    expect(parseTimedWorkflows([{ file: '.github/workflows/x.yml', text }])).toEqual([])
  })

  it('handles two schedules and a workflow without a name', () => {
    const text =
      "on:\n  schedule:\n    - cron: '1 * * * *'\n    - cron: '2 * * * *'\njobs:\n  a: {}\n"
    const [workflow] = parseTimedWorkflows([{ file: '.github/workflows/x.yml', text }])
    expect(workflow.name).toBe('x.yml')
    expect(workflow.crons).toEqual(['1 * * * *', '2 * * * *'])
  })
})

describe('parseServerCrons', () => {
  const script = [
    '#!/usr/bin/env bash',
    'BACKUP_SCRIPT="$APP_DIR/current/ops/backup.sh"',
    'OTHER_SCRIPT="$APP_DIR/current/ops/other.sh" # after the first',
    'cat >"$tmp" <<EOF',
    '# Daily backup',
    'SHELL=/bin/bash',
    '15 8 * * * root bash $BACKUP_SCRIPT daily >> /var/log/x.log 2>&1; bash $OTHER_SCRIPT daily >> /var/log/x.log 2>&1',
    'EOF',
  ].join('\n')

  it('reads the schedule and the scripts a cron line runs, without log paths', () => {
    expect(parseServerCrons([{ file: 'ops/install-cron.sh', text: script }])).toEqual([
      {
        file: 'ops/install-cron.sh',
        cron: '15 8 * * *',
        runs: ['ops/backup.sh daily', 'ops/other.sh daily'],
      },
    ])
  })

  it('keeps only the commands that call a script the file names', () => {
    const text = [
      'BACKUP_SCRIPT="$APP_DIR/current/ops/backup.sh"',
      '5 4 * * * root cd /srv; bash $UNKNOWN_SCRIPT now; bash $BACKUP_SCRIPT daily',
    ].join('\n')
    expect(parseServerCrons([{ file: 'ops/a.sh', text }])[0].runs).toEqual(['ops/backup.sh daily'])
  })

  it('sorts the scripts by file', () => {
    const line = '1 2 * * * root bash $A now'
    const found = parseServerCrons([
      { file: 'ops/z.sh', text: `A="x/z.sh"\n${line}` },
      { file: 'ops/a.sh', text: `A="x/a.sh"\n${line}` },
    ])
    expect(found.map((row) => row.file)).toEqual(['ops/a.sh', 'ops/z.sh'])
  })

  it('gives nothing for a script that installs no cron line', () => {
    expect(parseServerCrons([{ file: 'ops/a.sh', text: 'echo "1 2 3"\n' }])).toEqual([])
  })
})

describe('parseIntelligenceSchedule', () => {
  it('reads the cron and time zone of the pipeline settings', () => {
    const text = "enabled: true\nschedule:\n  cron: '40 6 * * *'\n  timezone: America/Chicago\n"
    expect(parseIntelligenceSchedule({ file: 'intelligence/pipeline.yaml', text })).toEqual({
      file: 'intelligence/pipeline.yaml',
      cron: '40 6 * * *',
      timezone: 'America/Chicago',
    })
  })

  it('is null when there is no schedule', () => {
    expect(parseIntelligenceSchedule({ file: 'a.yaml', text: 'enabled: true\n' })).toBeNull()
  })
})

describe('parseDependabot', () => {
  it('lists each update with its ecosystem, folder and interval', () => {
    const text = [
      'version: 2',
      'updates:',
      "  - package-ecosystem: 'npm'",
      "    directory: '/'",
      '    schedule:',
      "      interval: 'weekly'",
      "      day: 'monday'",
      "  - package-ecosystem: 'github-actions'",
      "    directory: '/'",
      '    schedule:',
      "      interval: 'daily'",
    ].join('\n')
    expect(parseDependabot({ file: '.github/dependabot.yml', text })).toEqual([
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
        when: 'daily',
      },
    ])
  })
})
