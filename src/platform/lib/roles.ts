/**
 * The roles an account can have (glossary: People and roles). One list for the users collection,
 * the role checks in `platform/payload/roles.ts` and any module that needs a role as a type.
 * `guest` is the default: an account whose home address nobody has verified. `resident` is for a
 * verified neighbour, and gets the same access until residency checks exist (#520, #314).
 */
export const ROLES = {
  admin: 'admin',
  editor: 'editor',
  guest: 'guest',
  resident: 'resident',
  agent: 'agent',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/**
 * The collection whose documents are accounts with a role. Role checks trust only principals from
 * it: an MCP API key can also authenticate a request as the key document itself (#336).
 */
export const ACCOUNTS_COLLECTION = 'users'
