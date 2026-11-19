import type { CollectionConfig } from 'payload'

import { isNoOne, serverOnlyFieldAccess } from '@/platform/payload/roles'

import { CHALLENGE_PURPOSES, PASSKEY_CHALLENGES } from '../domain/passkeys'
import { USERS } from '../domain/usersCollection'

/**
 * The one-time challenges passkey sign-in and adding use (#1313, decision 0021). A challenge is
 * taken once, by one conditional update that sets `usedAt` (`data/passkeys.ts`), and expired rows
 * are deleted by the retention task. No one reads or writes it through an API, admins included:
 * the challenge is the secret a stolen answer would need.
 */
export const PasskeyChallenges: CollectionConfig = {
  slug: PASSKEY_CHALLENGES,
  access: {
    read: isNoOne,
    create: isNoOne,
    update: isNoOne,
    delete: isNoOne,
  },
  admin: { hidden: true },
  fields: [
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: CHALLENGE_PURPOSES.map((purpose) => ({ label: purpose, value: purpose })),
      access: serverOnlyFieldAccess,
    },
    { name: 'challenge', type: 'text', required: true, access: serverOnlyFieldAccess },
    { name: 'expiresAt', type: 'date', required: true, index: true, access: serverOnlyFieldAccess },
    { name: 'usedAt', type: 'date', access: serverOnlyFieldAccess },
    // The account that is adding a passkey; empty for a sign-in, which names no one
    { name: 'account', type: 'relationship', relationTo: USERS, access: serverOnlyFieldAccess },
  ],
  timestamps: true,
}
