import type { Field } from 'payload'

import { MINIMAL_SCOPES, SCOPE_LABELS, SCOPES } from '../domain/scopes'

/**
 * What every connected AI tool has, whether it signs in with OAuth or a key (#1499): the scopes
 * an admin gives it and an optional expiry. One definition for the OAuth clients and the MCP API
 * keys, so a change to either is made once. A new client gets read only. Scopes only narrow:
 * the agent account's own access stays the final word.
 */
export const clientAccessFields: Field[] = [
  {
    name: 'scopes',
    type: 'select',
    hasMany: true,
    required: true,
    defaultValue: [...MINIMAL_SCOPES],
    options: SCOPES.map((value) => ({ value, label: SCOPE_LABELS[value] })),
    admin: {
      description:
        'What this AI agent may do. We can only narrow what its agent account allows, never widen it. A change applies on its next request.',
    },
  },
  {
    name: 'expiresAt',
    type: 'date',
    admin: {
      date: { pickerAppearance: 'dayAndTime' },
      description:
        'Optional. After this time the AI agent is refused until an admin sets a later time or leaves this empty.',
    },
  },
]
