import { describe, expect, it } from 'vitest'

import { dropLabel, ensureLabel } from './labels.mjs'

// An Octokit error: the status, and the validation errors GitHub lists in the response body
const failing = (status, code) => async () => {
  throw Object.assign(new Error('api'), {
    status,
    response: { data: { errors: code ? [{ resource: 'Label', code }] : [] } },
  })
}
const github = (overrides) => ({ rest: { issues: overrides } })

describe('ensureLabel', () => {
  it('creates the label with its color and description', async () => {
    const calls = []
    const api = github({ createLabel: async (args) => calls.push(args) })
    await ensureLabel(api, { owner: 'o', repo: 'r' }, { name: 'x', color: 'abc123' })
    expect(calls).toEqual([{ owner: 'o', repo: 'r', name: 'x', color: 'abc123' }])
  })

  it('passes on a 422 that is not "already exists", such as a description that is too long', async () => {
    const api = github({ createLabel: failing(422, 'invalid') })
    await expect(ensureLabel(api, { owner: 'o', repo: 'r' }, { name: 'x' })).rejects.toThrow('api')
  })

  it('accepts a label that already exists (422)', async () => {
    const api = github({ createLabel: failing(422, 'already_exists') })
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
