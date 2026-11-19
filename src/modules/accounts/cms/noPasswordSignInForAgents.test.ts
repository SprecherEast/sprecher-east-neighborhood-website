import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

import { noPasswordSignInForAgents } from './noPasswordSignInForAgents'

type HookArgs = Parameters<typeof noPasswordSignInForAgents>[0]
const signIn = (role: string) =>
  noPasswordSignInForAgents({
    user: { id: 1, role, collection: 'users' },
    req: {} as PayloadRequest,
  } as unknown as HookArgs)

describe('noPasswordSignInForAgents', () => {
  it('refuses an agent account with the same error as a wrong password', () => {
    expect(() => signIn('agent')).toThrow(/email or password/i)
  })

  it('lets every other role sign in', () => {
    for (const role of ['admin', 'editor', 'guest', 'resident']) {
      expect(signIn(role)).toMatchObject({ role })
    }
  })
})
