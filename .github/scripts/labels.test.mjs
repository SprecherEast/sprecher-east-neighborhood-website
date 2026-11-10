import { describe, expect, it } from 'vitest'

import { dropLabel, ensureLabel } from './labels.mjs'

const failing = (status) => async () => {
  throw Object.assign(new Error('api'), { status })
}
const github = (overrides) => ({ rest: { issues: overrides } })

describe('ensureLabel', () => {
  it('creates the label with its color and description', async () => {
    const calls = []
    const api = github({ createLabel: async (args) => calls.push(args) })
    await ensureLabel(api, { owner: 'o', repo: 'r' }, { name: 'x', color: 'abc123' })
    expect(calls).toEqual([{ owner: 'o', repo: 'r', name: 'x', color: 'abc123' }])
  })

  it('accepts a label that already exists (422)', async () => {
    const api = github({ createLabel: failing(422) })
    await expect(
      ensureLabel(api, { owner: 'o', repo: 'r' }, { name: 'x' }),
    ).resolves.toBeUndefined()
  })

  it('passes any other error on', async () => {
    const api = github({ createLabel: failing(500) })
    await expect(ensureLabel(api, { owner: 'o', repo: 'r' }, { name: 'x' })).rejects.toThrow('api')
  })
})

describe('dropLabel', () => {
  const target = { owner: 'o', repo: 'r', issue_number: 3 }

  it('removes the label from the issue', async () => {
    const calls = []
    const api = github({ removeLabel: async (args) => calls.push(args) })
    await dropLabel(api, target, 'x')
    expect(calls).toEqual([{ ...target, name: 'x' }])
  })

  it('accepts a label that is not on the issue (404)', async () => {
    await expect(
      dropLabel(github({ removeLabel: failing(404) }), target, 'x'),
    ).resolves.toBeUndefined()
  })

  it('passes any other error on', async () => {
    await expect(dropLabel(github({ removeLabel: failing(403) }), target, 'x')).rejects.toThrow(
      'api',
    )
  })
})
