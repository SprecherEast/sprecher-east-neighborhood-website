import { describe, expect, it } from 'vitest'

import { buildHistory, parseGitLog } from './history.mjs'

const LOG = [
  '\x1ec3\x1f2026-11-26T10:00:00Z\x1fSecond change',
  '',
  'src/modules/events/cms/events.ts',
  'docs/reference/content-types/events.md',
  '',
  '\x1ec2\x1f2026-11-25T10:00:00Z\x1fFirst change',
  '',
  'src/platform/ui/Button.tsx',
  '',
  '\x1ec1\x1f2026-11-24T10:00:00Z\x1fOldest',
  '',
  'README.md',
  '',
].join('\n')

const graph = {
  nodes: [
    { id: 'module:events', type: 'module', path: 'src/modules/events/README.md', links: [] },
    {
      id: 'collection:events',
      type: 'collection',
      path: 'src/modules/events/cms/events.ts',
      links: ['docs/reference/content-types/events.md'],
    },
    {
      id: 'shared-component:Button',
      type: 'shared-component',
      path: 'src/platform/ui/Button.tsx',
      links: [],
    },
    { id: 'platform-area:ui', type: 'platform-area', path: 'src/platform/ui', links: [] },
    { id: 'site:x', type: 'site', path: 'docs/project.md', links: [] },
  ],
}

describe('parseGitLog', () => {
  it('reads commits, newest first, with their files', () => {
    expect(parseGitLog(LOG)).toEqual([
      {
        sha: 'c3',
        date: '2026-11-26T10:00:00Z',
        subject: 'Second change',
        files: ['src/modules/events/cms/events.ts', 'docs/reference/content-types/events.md'],
      },
      {
        sha: 'c2',
        date: '2026-11-25T10:00:00Z',
        subject: 'First change',
        files: ['src/platform/ui/Button.tsx'],
      },
      { sha: 'c1', date: '2026-11-24T10:00:00Z', subject: 'Oldest', files: ['README.md'] },
    ])
  })

  it('reads an empty log as no commits', () => {
    expect(parseGitLog('')).toEqual([])
  })
})

describe('buildHistory', () => {
  const history = buildHistory({ graph, commits: parseGitLog(LOG) })

  it('gives each node its last commit and date', () => {
    expect(history.nodes['collection:events']).toEqual({
      sha: 'c3',
      date: '2026-11-26T10:00:00Z',
      subject: 'Second change',
    })
    expect(history.nodes['shared-component:Button']).toMatchObject({ sha: 'c2' })
  })

  it("counts a change under a module's folder as a change of the module, and a file in a folder node as the folder's", () => {
    expect(history.nodes['module:events']).toMatchObject({ sha: 'c3' })
    expect(history.nodes['platform-area:ui']).toMatchObject({ sha: 'c2' })
  })

  it('leaves out a node nothing has changed', () => {
    expect(history.nodes['site:x']).toBeUndefined()
  })

  it('lists the nodes each commit changed, so a reader can ask what changed since a build', () => {
    expect(history.commits.map((c) => [c.sha, c.nodes])).toEqual([
      ['c3', ['collection:events', 'module:events']],
      ['c2', ['platform-area:ui', 'shared-component:Button']],
    ])
  })

  it('is marked as having history, and as empty when there is none', () => {
    expect(history.available).toBe(true)
    expect(buildHistory({ graph, commits: [] })).toEqual({
      available: false,
      reason: 'no history to read',
      head: '',
      nodes: {},
      commits: [],
    })
  })
})
