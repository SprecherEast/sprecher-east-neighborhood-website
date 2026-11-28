import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type FieldAccess,
} from 'payload'

import { ACCOUNTS_COLLECTION } from '@/platform/lib'
import { isAdmin, isAdminFieldAccess } from '@/platform/payload/roles'

import { OAUTH_CLIENTS, OAUTH_TOKENS } from '../../domain/oauth/constants'
import { isRevokingFamily, revokeUnrevoked } from './revokeTokens'

/**
 * Revoking one credential in Admin revokes its whole family (the codes, access tokens and
 * refresh tokens that came from one approval), so the tool really is signed out.
 */
const revokeFamily: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (isRevokingFamily(req) || !doc.revokedAt || previousDoc?.revokedAt) return doc
  await revokeUnrevoked(req, { family: { equals: doc.family } }, doc.revokedAt)
  return doc
}

/** A revoked row stays revoked: the date can be neither cleared nor moved by an admin. */
const keepRevoked: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (!originalDoc?.revokedAt || !('revokedAt' in data)) return data
  const same =
    data.revokedAt &&
    new Date(data.revokedAt).getTime() === new Date(originalDoc.revokedAt).getTime()
  if (!same) throw new APIError('A revoked token stays revoked.', 400, null, true)
  return data
}

const never: FieldAccess = () => false
/** Visible to admins and never writable by anyone: only the sign-in code writes these. */
const readOnly = { read: isAdminFieldAccess, create: never, update: never }

/**
 * Every code, access token and refresh token OAuth has issued (#1501), as its HMAC hash: the
 * credential itself is shown to the client once and never stored. Admins can read the rows and
 * revoke them (set `revokedAt`, which then stays); nothing creates or edits them through the API.
 */
export const OAuthTokens: CollectionConfig = {
  slug: OAUTH_TOKENS,
  labels: { singular: 'OAuth token', plural: 'OAuth tokens' },
  admin: {
    group: 'Agents',
    defaultColumns: ['kind', 'client', 'expiresAt', 'usedAt', 'revokedAt'],
    description:
      'Sign-ins of AI tools, stored as hashes. Set "Revoked at" on any row to sign that tool out.',
  },
  access: { create: () => false, read: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { beforeChange: [keepRevoked], afterChange: [revokeFamily] },
  timestamps: true,
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['code', 'access', 'refresh'],
      access: readOnly,
    },
    {
      name: 'tokenHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      access: { read: never, create: never, update: never },
      admin: { hidden: true },
    },
    { name: 'family', type: 'text', required: true, index: true, access: readOnly },
    {
      name: 'client',
      type: 'relationship',
      relationTo: OAUTH_CLIENTS,
      required: true,
      access: readOnly,
    },
    {
      name: 'agent',
      type: 'relationship',
      relationTo: ACCOUNTS_COLLECTION,
      required: true,
      access: readOnly,
    },
    {
      name: 'consentedBy',
      type: 'relationship',
      relationTo: ACCOUNTS_COLLECTION,
      access: readOnly,
    },
    { name: 'resource', type: 'text', required: true, access: readOnly },
    { name: 'scope', type: 'text', access: readOnly },
    { name: 'expiresAt', type: 'date', required: true, index: true, access: readOnly },
    { name: 'usedAt', type: 'date', access: readOnly },
    { name: 'revokedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'redirectUri', type: 'text', access: readOnly },
    { name: 'codeChallenge', type: 'text', access: readOnly, admin: { hidden: true } },
  ],
}
