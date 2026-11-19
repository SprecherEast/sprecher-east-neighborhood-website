import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'
import {
  hasAdminOrEditor,
  hasAgent,
  isAdmin,
  isAdminFieldAccess,
  isAdminOrEditor,
  isAdminOrEditorBoolean,
  isAdminOrEditorFieldAccess,
  isAdminOrSelf,
  isStaffOrAgent,
  isStaffRole,
} from './roles'

/** A user with only the fields the role checks read. */
const user = (role: User['role'] | undefined, id = 1): User =>
  ({ id, email: 'person@example.com', role }) as User

/** The slice of Payload's access arguments these checks use. */
const args = (u: User | null, id?: number) =>
  ({ req: { user: u } as PayloadRequest, id }) as Parameters<typeof isAdminOrSelf>[0]

const admin = user('admin')
const editor = user('editor')
const resident = user('resident')
const noRole = user(undefined)

describe('isStaffRole', () => {
  it('is true for admin and editor only', () => {
    expect(isStaffRole('admin')).toBe(true)
    expect(isStaffRole('editor')).toBe(true)
    expect(isStaffRole('resident')).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
    expect(isStaffRole('Admin')).toBe(false)
  })
})

describe('hasAdminOrEditor', () => {
  it('is true for admins and editors only', () => {
    expect(hasAdminOrEditor(admin)).toBe(true)
    expect(hasAdminOrEditor(editor)).toBe(true)
    expect(hasAdminOrEditor(resident)).toBe(false)
    expect(hasAdminOrEditor(null)).toBe(false)
  })

  it('treats a user without a role as a guest', () => {
    expect(hasAdminOrEditor(noRole)).toBe(false)
  })
})

describe('collection access', () => {
  it('isAdmin allows admins only', () => {
    expect(isAdmin(args(admin))).toBe(true)
    expect(isAdmin(args(editor))).toBe(false)
    expect(isAdmin(args(resident))).toBe(false)
    expect(isAdmin(args(null))).toBe(false)
  })

  it('isAdminOrEditor allows staff, not residents or visitors', () => {
    expect(isAdminOrEditor(args(admin))).toBe(true)
    expect(isAdminOrEditor(args(editor))).toBe(true)
    expect(isAdminOrEditor(args(resident))).toBe(false)
    expect(isAdminOrEditor(args(null))).toBe(false)
  })

  it('isAdminOrEditorBoolean gives the same answers as a plain boolean', () => {
    expect(isAdminOrEditorBoolean(args(editor))).toBe(true)
    expect(isAdminOrEditorBoolean(args(resident))).toBe(false)
  })
})

describe('isAdminOrSelf', () => {
  it('lets an admin reach any user', () => {
    expect(isAdminOrSelf(args(admin, 99))).toBe(true)
  })

  it('lets a resident reach only their own record', () => {
    expect(isAdminOrSelf(args(user('resident', 7), 7))).toBe(true)
    expect(isAdminOrSelf(args(user('resident', 7), 8))).toBe(false)
  })

  it('does not let an editor reach other users', () => {
    expect(isAdminOrSelf(args(user('editor', 3), 4))).toBe(false)
  })

  it('denies a non-admin when no record id is given (no list access)', () => {
    expect(isAdminOrSelf(args(resident))).toBe(false)
  })

  it('denies visitors', () => {
    expect(isAdminOrSelf(args(null, 1))).toBe(false)
  })
})

describe('field access', () => {
  const fieldArgs = (u: User | null) =>
    ({ req: { user: u } as PayloadRequest }) as Parameters<typeof isAdminFieldAccess>[0]

  it('only admins may set roles', () => {
    expect(isAdminFieldAccess(fieldArgs(admin))).toBe(true)
    expect(isAdminFieldAccess(fieldArgs(editor))).toBe(false)
  })

  it('only staff may read private fields such as form email routing', () => {
    expect(isAdminOrEditorFieldAccess(fieldArgs(editor))).toBe(true)
    expect(isAdminOrEditorFieldAccess(fieldArgs(resident))).toBe(false)
    expect(isAdminOrEditorFieldAccess(fieldArgs(null))).toBe(false)
  })
})

describe('agents and API keys (#336)', () => {
  const agent = user('agent', 8)
  // An MCP API key can authenticate a REST request as the key document itself
  const key = { id: 1, collection: 'payload-mcp-api-keys' } as unknown as User

  it('knows an agent, which is neither staff nor admin', () => {
    expect(hasAgent(agent)).toBe(true)
    expect(hasAgent(resident)).toBe(false)
    expect(hasAdminOrEditor(agent)).toBe(false)
    expect(isStaffOrAgent(args(agent))).toBe(true)
    expect(isStaffOrAgent(args(editor))).toBe(true)
    expect(isStaffOrAgent(args(resident))).toBe(false)
  })

  it('treats a key acting as itself as signed out, even where its id matches an account', () => {
    expect(hasAgent(key)).toBe(false)
    expect(isStaffOrAgent(args(key))).toBe(false)
    expect(isAdminOrSelf(args(key, 1))).toBe(false)
  })
})
