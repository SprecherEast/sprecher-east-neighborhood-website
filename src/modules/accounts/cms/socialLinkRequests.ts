import type { CollectionConfig } from 'payload'

import { isNoOne, serverOnlyFieldAccess } from '@/platform/payload/roles'

import { SOCIAL_LINK_REQUESTS } from '../domain/googleLink'
import { SOCIAL_PROVIDERS } from '../domain/socialSignIn'

/**
 * What Google said, kept for the ten minutes the neighbor takes to enter their password (#1338,
 * decision 0020): the Google id and the email Google verified. It never reaches a page or the
 * browser, and no one reads or writes it through an API, admins included: it is what links Google
 * to an account. It is taken once, by one conditional update that sets `usedAt`
 * (`data/socialLinkRequests.ts`), and expired rows are deleted by the retention task.
 */
export const SocialLinkRequests: CollectionConfig = {
  slug: SOCIAL_LINK_REQUESTS,
  access: {
    read: isNoOne,
    create: isNoOne,
    update: isNoOne,
    delete: isNoOne,
  },
  admin: { hidden: true },
  fields: [
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: SOCIAL_PROVIDERS.map((provider) => ({ label: provider, value: provider })),
      access: serverOnlyFieldAccess,
    },
    { name: 'subject', type: 'text', required: true, access: serverOnlyFieldAccess },
    { name: 'email', type: 'text', required: true, access: serverOnlyFieldAccess },
    { name: 'expiresAt', type: 'date', required: true, index: true, access: serverOnlyFieldAccess },
    { name: 'usedAt', type: 'date', access: serverOnlyFieldAccess },
  ],
  timestamps: true,
}
