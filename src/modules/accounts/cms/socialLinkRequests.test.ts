import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { isNoOne, serverOnlyFieldAccess } from '@/platform/payload/roles'

import { SocialLinkRequests } from './socialLinkRequests'

const fields = SocialLinkRequests.fields.filter(
  (f): f is Field & { name: string } => 'name' in f && typeof f.name === 'string',
)

describe('SocialLinkRequests collection (#1338, decision 0020)', () => {
  it('is named social-link-requests', () => {
    expect(SocialLinkRequests.slug).toBe('social-link-requests')
  })

  it('gives no one access over any API, admins included', () => {
    expect(SocialLinkRequests.access).toEqual({
      read: isNoOne,
      create: isNoOne,
      update: isNoOne,
      delete: isNoOne,
    })
  })

  it('stays out of the admin navigation', () => {
    expect(SocialLinkRequests.admin?.hidden).toBe(true)
  })

  it('stores the provider, Google id, verified email, expiry and use, all server-only', () => {
    expect(fields.map((f) => f.name)).toEqual([
      'provider',
      'subject',
      'email',
      'expiresAt',
      'usedAt',
    ])
    for (const f of fields) {
      expect((f as { access?: unknown }).access, f.name).toBe(serverOnlyFieldAccess)
    }
  })

  it('indexes the expiry, which the hourly purge filters on', () => {
    expect(fields.find((f) => f.name === 'expiresAt')).toMatchObject({ index: true })
  })
})
