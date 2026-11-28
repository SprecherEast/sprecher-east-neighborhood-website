import type { CollectionConfig, Field } from 'payload'

import { ROLES } from '@/platform/lib'
import { isAdmin, isAdminFieldAccess } from '@/platform/payload/roles'

import { clientAccessFields } from './clientAccessFields'

/**
 * The MCP plugin's API keys (#336), admin-only. The plugin lets any signed-in account manage its
 * own keys; here only admins create, read, change or delete keys, and each key belongs to an
 * agent account, so no key acts as staff. The key itself is shown once in Admin and stored
 * encrypted by Payload (`useAPIKey`). Like an OAuth client, it carries scopes and an optional
 * expiry (#1499); unticking "Enable API key" stops it at once.
 */
const bindToAgent = (field: Field): Field =>
  'name' in field && field.name === 'user' && field.type === 'relationship'
    ? {
        ...field,
        access: { create: isAdminFieldAccess, update: isAdminFieldAccess },
        // Payload validates the chosen account against this filter on save, not only in the picker
        filterOptions: { role: { equals: ROLES.agent } },
      }
    : field

export const adminOnlyApiKeys = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  access: {
    ...collection.access,
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    unlock: isAdmin,
  },
  admin: { ...collection.admin, group: 'Agents' },
  fields: [...collection.fields.map(bindToAgent), ...clientAccessFields],
})
