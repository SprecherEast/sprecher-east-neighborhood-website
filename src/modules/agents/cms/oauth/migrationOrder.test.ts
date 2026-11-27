import { describe, expect, it } from 'vitest'

import { migrations } from '@/migrations'

/**
 * Payload runs migrations in the order of this list, which is the order of their names. The OAuth
 * sign-in migration (#1501) adds two keys to the edit-lock table, and the delete-rule migration
 * (#1559) rebuilds that table and refuses columns it does not expect, so on a fresh database the
 * OAuth one must run after it, or the migrating stops.
 */
describe('the migration list', () => {
  const names = migrations.map((migration) => migration.name)

  it('is in the order of the names, each name once', () => {
    expect(names).toEqual([...names].sort())
    expect(new Set(names).size).toBe(names.length)
  })

  it('runs the OAuth sign-in migration after the delete-rule migration once both are present', () => {
    const oauth = names.findIndex((name) => name.endsWith('_mcp_oauth_sign_in'))
    const deleteRules = names.findIndex((name) => name.endsWith('_foreign_key_delete_rules'))
    expect(oauth).toBeGreaterThanOrEqual(0)
    if (deleteRules >= 0) expect(oauth).toBeGreaterThan(deleteRules)
  })

  it('names the OAuth migration later than the delete-rule migration, which is 20261126_203500', () => {
    const oauth = names.find((name) => name.endsWith('_mcp_oauth_sign_in')) ?? ''
    expect(oauth > '20261126_203500_foreign_key_delete_rules').toBe(true)
  })
})
