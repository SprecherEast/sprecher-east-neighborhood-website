import type {
  CollectionAfterChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { ACCOUNTS_COLLECTION, relationId, ROLES } from '@/platform/lib'
import { isAdmin, isAdminFieldAccess } from '@/platform/payload/roles'

import { OAUTH_CLIENTS, OAUTH_TOKENS } from '../../domain/oauth/constants'
import { checkRegisteredRedirectUri } from '../../domain/oauth/redirectUri'
import { generateClientId } from '../../domain/oauth/secrets'

/** The client's public ID is made by the server when it is registered, and never changes. */
const giveClientId: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (operation === 'create') return { ...data, clientId: generateClientId() }
  return { ...data, clientId: originalDoc?.clientId }
}

/** A client's sign-ins go with it, so deleting a client is never blocked by its own rows. */
const deleteTokensWithClient: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: OAUTH_TOKENS,
    where: { client: { equals: id } },
    overrideAccess: true,
    req,
  })
}

/**
 * Moving a client to another agent account ends what it was given as the old one: every code,
 * access token and refresh token of the client is revoked, for good (moving it back does not
 * bring them back). The tool signs in again and acts as the new account.
 */
const revokeWhenAgentChanges: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update' || relationId(previousDoc?.agent) === relationId(doc.agent)) return doc
  await req.payload.update({
    collection: OAUTH_TOKENS,
    where: { client: { equals: doc.id }, revokedAt: { exists: false } },
    data: { revokedAt: new Date().toISOString() },
    overrideAccess: true,
    req,
    context: { revokingOAuthFamily: true },
  })
  return doc
}

/**
 * The AI tools an admin has allowed to sign in to the MCP address (#1501), registered by hand:
 * there is no open registration. Each client acts as one agent account, so the access it gets is
 * what that account's role allows, and nothing a person's account could do. Admin-only in every
 * operation, and the redirect addresses are validated on save, not only in the form.
 */
export const OAuthClients: CollectionConfig = {
  slug: OAUTH_CLIENTS,
  labels: { singular: 'OAuth client', plural: 'OAuth clients' },
  admin: {
    group: 'Agents',
    useAsTitle: 'name',
    defaultColumns: ['name', 'agent', 'enabled', 'clientId'],
    description:
      'AI tools that may sign in to the AI agent address. Give the tool the client ID; no secret is used.',
  },
  access: { create: isAdmin, read: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeValidate: [giveClientId],
    afterChange: [revokeWhenAgentChanges],
    beforeDelete: [deleteTokensWithClient],
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 80,
      admin: { description: 'Shown to the admin who approves the connection.' },
    },
    {
      name: 'clientId',
      type: 'text',
      unique: true,
      index: true,
      access: { create: () => false, update: () => false, read: isAdminFieldAccess },
      admin: { readOnly: true, description: 'Made when you save. Paste it into the AI tool.' },
    },
    {
      name: 'agent',
      type: 'relationship',
      relationTo: ACCOUNTS_COLLECTION,
      required: true,
      // Payload checks the chosen account against this on save, not only in the picker
      filterOptions: { role: { equals: ROLES.agent } },
      access: { create: isAdminFieldAccess, update: isAdminFieldAccess },
      admin: {
        description: 'The agent account this tool acts as. Its role limits what it can do.',
      },
    },
    {
      name: 'redirectUris',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 5,
      labels: { singular: 'Redirect address', plural: 'Redirect addresses' },
      admin: { description: 'The only addresses a sign-in may return to, written in full.' },
      fields: [
        {
          name: 'uri',
          type: 'text',
          required: true,
          maxLength: 500,
          validate: (value: unknown) =>
            typeof value === 'string' ? (checkRegisteredRedirectUri(value) ?? true) : 'Required',
        },
      ],
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Untick to stop this tool at once: its tokens stop working.' },
    },
  ],
}
