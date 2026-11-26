import { describe, expect, it } from 'vitest'

import { changedSince, choices } from './changes.mjs'

const history = {
  available: true,
  head: 'c3',
  nodes: {},
  commits: [
    { sha: 'c3', date: '2026-11-26', subject: 'Third', nodes: ['a', 'b'] },
    { sha: 'c2', date: '2026-11-25', subject: 'Second', nodes: ['b', 'c'] },
    { sha: 'c1', date: '2026-11-24', subject: 'First', nodes: ['d'] },
  ],
}

describe('changedSince (#1463)', () => {
  it('lists the nodes of the commits after the chosen one, newest first, once each', () => {
    const { ids, list } = changedSince(history, 'c1')
    expect([...ids].sort()).toEqual(['a', 'b', 'c'])
    expect(list.map((c) => [c.id, c.sha])).toEqual([
      ['a', 'c3'],
      ['b', 'c3'],
      ['c', 'c2'],
    ])
  })

  it('gives nothing at the newest commit, and everything for an unknown one', () => {
    expect(changedSince(history, 'c3').list).toEqual([])
    expect(changedSince(history, 'zzz').ids.size).toBe(4)
  })

  it('gives nothing when there is no history', () => {
    expect(changedSince({ available: false, commits: [] }, 'c1').ids.size).toBe(0)
    expect(choices(null)).toEqual([])
    expect(choices(history)).toHaveLength(3)
  })
})
