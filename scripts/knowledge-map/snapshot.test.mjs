import { describe, expect, it } from 'vitest'

import { buildSnapshot, emptySnapshot } from './snapshot.mjs'

const graph = {
  nodes: [
    { id: 'module:events', type: 'module', path: 'src/modules/events/README.md' },
    { id: 'collection:events', type: 'collection', path: 'src/modules/events/cms/events.ts' },
    { id: 'platform-area:ui', type: 'platform-area', path: 'src/platform/ui' },
    { id: 'skill:wrapped', type: 'skill', path: '.agents/skills/wrapped/SKILL.md' },
  ],
}

const issue = (number, files, over = {}) => ({
  number,
  title: `Issue ${number}`,
  html_url: `https://github.com/o/r/issues/${number}`,
  labels: [{ name: 'bug' }],
  body: `### Files likely touched\n\n${files}\n\n### Must not touch\n\nNone\n`,
  ...over,
})

describe('buildSnapshot', () => {
  const issues = [
    issue(10, '`src/modules/events/cms/events.ts`, `src/platform/ui/Card.tsx`'),
    issue(11, '`src/modules/events/`'),
    issue(12, 'None'),
    issue(13, 'in prose only'),
    issue(14, '`.agents/skills/`', { pull_request: {} }),
  ]
  const snapshot = buildSnapshot({ graph, issues, date: '2026-11-26' })

  it('carries its date and how many issues it read', () => {
    expect(snapshot).toMatchObject({ available: true, date: '2026-11-26', issues: 4 })
  })

  it('matches an issue to each node its declared paths touch, a folder reaching what is inside it', () => {
    expect(snapshot.nodes['collection:events'].map((t) => t.number)).toEqual([10, 11])
    expect(snapshot.nodes['module:events'].map((t) => t.number)).toEqual([10, 11])
    expect(snapshot.nodes['platform-area:ui'].map((t) => t.number)).toEqual([10])
  })

  it('gives each task its number, title, link and labels', () => {
    expect(snapshot.nodes['platform-area:ui'][0]).toEqual({
      number: 10,
      title: 'Issue 10',
      url: 'https://github.com/o/r/issues/10',
      labels: ['bug'],
    })
  })

  it('skips pull requests and an issue that declares no paths', () => {
    expect(JSON.stringify(snapshot.nodes)).not.toContain('"number":14')
    expect(JSON.stringify(snapshot.nodes)).not.toContain('"number":12')
    expect(snapshot.nodes['skill:wrapped']).toBeUndefined()
  })

  it('is empty and says why when there is no network', () => {
    expect(emptySnapshot('no network', '2026-11-26')).toEqual({
      available: false,
      reason: 'no network',
      date: '2026-11-26',
      issues: 0,
      nodes: {},
    })
  })
})
