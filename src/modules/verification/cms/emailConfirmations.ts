import type { CollectionConfig } from 'payload'

import type { HumanVerifier } from '@/platform/lib/humanCheck'
import type { EmailConfirmedListener } from '@/platform/payload/emailConfirmer'
import { isAdmin, serverOnlyFieldAccess } from '@/platform/payload/roles'
import { TurnstileVerifier } from '@/platform/turnstile/turnstileVerifier'

import { EMAIL_CONFIRMATIONS } from '../domain/paths'
import { confirmEndpoint } from './confirmEndpoint'

/** Set by the server only: shown in Admin, never edited there. */
const readOnly = { readOnly: true, position: 'sidebar' } as const

/**
 * Email addresses people typed into a public form, and whether they confirmed them by link
 * (#183). Kept apart from accounts (`users`). Only admins can see or change it: it is personal
 * data, and the server writes it with access bypassed. `onConfirmed` runs once per address when
 * its link is clicked; `payload.config.ts` passes in what other modules need (decision 0008).
 * `humanVerifier` is the robot check the Confirm button must pass (#303); Turnstile by default.
 */
export const createEmailConfirmations = ({
  onConfirmed = [],
  humanVerifier = new TurnstileVerifier(),
}: {
  onConfirmed?: readonly EmailConfirmedListener[]
  humanVerifier?: HumanVerifier
} = {}): CollectionConfig => ({
  slug: EMAIL_CONFIRMATIONS,
  endpoints: [confirmEndpoint(onConfirmed, humanVerifier)],
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    defaultColumns: ['email', 'confirmedAt', 'lastSentAt'],
    description:
      'Addresses typed into a public form, and when they were confirmed by link. Unconfirmed ones are deleted automatically 48 hours after their last link. A confirmed one is deleted automatically 12 months after it was confirmed, unless they have an account or a message that is still kept (one from the last 12 months, or on hold). To remove an address on request sooner, delete it here.',
    useAsTitle: 'email',
  },
  defaultSort: '-updatedAt',
  fields: [
    {
      // `email`, on purpose: Payload's check is stricter than `parseEmailAddress` (it refuses
      // "josé@example.com" or "ana@example.c"). For such an address no record is saved and no link
      // goes out; the confirmer catches the error and logs it, and the message that asked is kept,
      // unconfirmed. The site only emails addresses it can be sure are well formed.
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'confirmedAt',
      type: 'date',
      index: true,
      admin: { ...readOnly, description: 'When the link was clicked. Empty: not confirmed yet.' },
    },
    { name: 'welcomeSentAt', type: 'date', admin: readOnly },
    {
      name: 'lastSentAt',
      type: 'date',
      index: true,
      admin: { ...readOnly, description: 'When the latest confirmation link was sent.' },
    },
    // The link's token is never stored, only its SHA-256, and it never leaves the server. The
    // server-only fields refuse writes too, even an admin's (#299)
    { name: 'tokenHash', type: 'text', index: true, hidden: true, access: serverOnlyFieldAccess },
    { name: 'tokenExpiresAt', type: 'date', admin: readOnly },
    // The per-address limit: links sent since sendWindowStart
    {
      name: 'sendCount',
      type: 'number',
      defaultValue: 0,
      hidden: true,
      access: serverOnlyFieldAccess,
    },
    { name: 'sendWindowStart', type: 'date', hidden: true, access: serverOnlyFieldAccess },
  ],
  timestamps: true,
})
