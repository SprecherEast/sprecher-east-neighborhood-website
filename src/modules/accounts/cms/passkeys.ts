import type { CollectionConfig } from 'payload'

import {
  isAdmin,
  isAdminFieldAccess,
  isNoOne,
  serverOnlyFieldAccess,
} from '@/platform/payload/roles'

import { PASSKEY_LABEL_MAX_LENGTH, PASSKEYS } from '../domain/passkeys'
import { USERS } from '../domain/usersCollection'

/**
 * What an admin sees for support: nothing writes it through an API, and only admins read it.
 * The key material is not here: it stays `serverOnlyFieldAccess`, readable by no one.
 */
const supportView = {
  create: serverOnlyFieldAccess.create,
  update: serverOnlyFieldAccess.update,
  read: isAdminFieldAccess,
}

/**
 * The passkeys residents saved to sign in with (#1313, decision 0021). Only server code writes
 * them, through the data layer with access bypassed: create and update are refused for everyone,
 * admins included, and an admin reads and deletes for support only. A resident never reads this
 * collection through the API; they see their own list through the module's use cases. The
 * credential ID is unique, so a save can only insert, and the owning account's delete removes
 * its passkeys (`deletePasskeysWithAccount`).
 */
export const Passkeys: CollectionConfig = {
  slug: PASSKEYS,
  access: {
    read: isAdmin,
    delete: isAdmin,
    create: isNoOne,
    update: isNoOne,
  },
  admin: {
    defaultColumns: ['label', 'account', 'createdAt', 'lastUsedAt'],
    description:
      'Passkeys residents added to sign in. Read and delete only, for support: a deleted passkey stops working at once, and the resident can still sign in with their password.',
    useAsTitle: 'label',
  },
  defaultSort: '-createdAt',
  disableDuplicate: true,
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: USERS,
      required: true,
      index: true,
      access: supportView,
    },
    // The credential's id and its public key (base64url). The public key can't sign, yet no one
    // reads them through an API: only the sign-in check does, on the server.
    {
      name: 'credentialId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hidden: true,
      access: serverOnlyFieldAccess,
    },
    {
      name: 'publicKey',
      type: 'text',
      required: true,
      hidden: true,
      access: serverOnlyFieldAccess,
    },
    // Written only when higher (`data/passkeys.ts`), so two sign-ins at once can't lower it
    { name: 'counter', type: 'number', required: true, defaultValue: 0, access: supportView },
    { name: 'transports', type: 'json', access: supportView },
    {
      name: 'deviceType',
      type: 'select',
      required: true,
      options: [
        { label: 'One device', value: 'singleDevice' },
        { label: 'Synced between devices', value: 'multiDevice' },
      ],
      access: supportView,
    },
    { name: 'backedUp', type: 'checkbox', defaultValue: false, access: supportView },
    {
      name: 'label',
      type: 'text',
      required: true,
      maxLength: PASSKEY_LABEL_MAX_LENGTH,
      access: supportView,
    },
    { name: 'lastUsedAt', type: 'date', access: supportView },
  ],
  timestamps: true,
}
