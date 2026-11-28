import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decideConsent: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('./data/oauth/viewer', () => ({ getViewer: async () => ({ id: 1, isAdmin: true }) }))
vi.mock('./use-cases/oauth/decideConsent', () => ({ decideConsent: mocks.decideConsent }))

import { decideConnectionForm } from './actions'
import { CONNECTION_REFUSED } from './domain/oauth/constants'

/** The approval as a form's action (#1501): the choice is the pressed button's value. */

const input = {
  request: {
    clientId: 'mcp_a',
    redirectUri: 'https://claude.ai/cb',
    state: 's',
    codeChallenge: 'c'.repeat(43),
    resource: 'https://example.com/api/mcp',
    scope: 'mcp',
  },
  ticket: '123.abc',
}
const form = (decision?: string) => {
  const data = new FormData()
  if (decision !== undefined) data.set('decision', decision)
  return data
}

beforeEach(() => {
  mocks.decideConsent.mockReset().mockResolvedValue({ kind: 'refused', message: 'Refused.' })
})

describe('decideConnectionForm', () => {
  it.each(['approve', 'deny'])('decides %s as the pressed button says', async (decision) => {
    await decideConnectionForm(input, null, form(decision))
    expect(mocks.decideConsent).toHaveBeenCalledWith(
      input.request,
      input.ticket,
      decision,
      expect.objectContaining({ isAdmin: true }),
    )
  })

  it('answers with the refusal, for the page to show', async () => {
    expect(await decideConnectionForm(input, null, form('approve'))).toEqual({
      message: 'Refused.',
    })
  })

  it('sends the browser back to the tool on success', async () => {
    mocks.decideConsent.mockResolvedValue({ kind: 'redirect', url: 'https://claude.ai/cb?code=x' })
    await expect(decideConnectionForm(input, null, form('approve'))).rejects.toThrow(
      'NEXT_REDIRECT https://claude.ai/cb?code=x',
    )
  })

  it.each([
    ['no choice', input, form()],
    ['another choice', input, form('delete')],
    ['no input', undefined, form('approve')],
    ['a string for input', 'approve', form('approve')],
    ['an input with no ticket', { request: input.request }, form('approve')],
  ])('refuses %s without deciding anything', async (_name, bad, data) => {
    expect(await decideConnectionForm(bad, null, data)).toEqual({ message: CONNECTION_REFUSED })
    expect(mocks.decideConsent).not.toHaveBeenCalled()
  })
})
