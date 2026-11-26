import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { EXTRAS_DIR, writeExtras } from './extras.mjs'

const made = []
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const graph = {
  nodes: [{ id: 'module:events', type: 'module', path: 'src/modules/events/README.md', links: [] }],
}
const LOG = '\x1ec1\x1f2026-11-26T10:00:00Z\x1fChange\n\nsrc/modules/events/cms/events.ts\n'
const ISSUES = JSON.stringify([
  [
    {
      number: 7,
      title: 'Seven',
      html_url: 'u',
      labels: [],
      body: '### Files likely touched\n\n`src/modules/events/`\n\n### Must not touch\n\nNone\n',
    },
  ],
])

function root() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-map-extras-'))
  made.push(dir)
  return dir
}
const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, EXTRAS_DIR, name), 'utf8'))

describe('writeExtras', () => {
  it('writes the change history and the dated open-issue snapshot beside each other', () => {
    const dir = root()
    const run = (command) => (command === 'git' ? LOG : ISSUES)
    const result = writeExtras({ root: dir, graph, run, date: '2026-11-26' })
    expect(result).toEqual({ history: true, snapshot: true })
    expect(read(dir, 'history.json').nodes['module:events']).toMatchObject({ sha: 'c1' })
    expect(read(dir, 'snapshot.json')).toMatchObject({
      available: true,
      date: '2026-11-26',
      issues: 1,
    })
  })

  it('writes an empty snapshot marked as such when the issues cannot be read, and never fails', () => {
    const dir = root()
    const run = (command) => {
      if (command === 'git') return LOG
      throw new Error('network unreachable')
    }
    expect(writeExtras({ root: dir, graph, run, date: '2026-11-26' })).toEqual({
      history: true,
      snapshot: false,
    })
    expect(read(dir, 'snapshot.json')).toEqual({
      available: false,
      reason: 'the open issues could not be read',
      date: '2026-11-26',
      issues: 0,
      nodes: {},
    })
  })

  it('writes an empty history marked as such when git has none', () => {
    const dir = root()
    const run = (command) => {
      if (command === 'git') throw new Error('not a repository')
      return '[]'
    }
    writeExtras({ root: dir, graph, run, date: '2026-11-26' })
    expect(read(dir, 'history.json')).toMatchObject({
      available: false,
      reason: 'no history to read',
    })
  })
})
