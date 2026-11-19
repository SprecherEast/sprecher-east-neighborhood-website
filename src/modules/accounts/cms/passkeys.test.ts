import type { CollectionConfig, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  isAdmin,
  isAdminFieldAccess,
  isNoOne,
  serverOnlyFieldAccess,
} from '@/platform/payload/roles'

import { Passkeys } from './passkeys'

const named = (fields: Field[]) =>
  fields.filter((f): f is Field & { name: string } => 'name' in f && typeof f.name === 'string')

const field = (name: string) => {
  const found = named(Passkeys.fields).find((f) => f.name === name)
  if (!found) throw new Error(`no field ${name}`)
  return found as Field & { access?: unknown; unique?: boolean; index?: boolean; hidden?: boolean }
}

describe('Passkeys collection (decision 0021)', () => {
  it('is named passkeys', () => {
    expect(Passkeys.slug).toBe('passkeys')
  })

  it('lets admins read and delete, and no one create or update', () => {
    expect(Passkeys.access).toEqual({
      read: isAdmin,
      delete: isAdmin,
      create: isNoOne,
      update: isNoOne,
    })
  })

  it('stores what the rules need, and nothing a resident can set', () => {
    expect(named(Passkeys.fields).map((f) => f.name)).toEqual([
      'account',
      'credentialId',
      'publicKey',
      'counter',
      'transports',
      'deviceType',
      'backedUp',
      'label',
      'lastUsedAt',
    ])
  })

  it('has a unique, indexed credential ID', () => {
    expect(field('credentialId')).toMatchObject({ unique: true, index: true, required: true })
  })

  it('indexes the owning account, which every list and delete filters on', () => {
    expect(field('account')).toMatchObject({ relationTo: 'users', required: true, index: true })
  })

  it('keeps the credential ID and the public key server-only: no one reads or writes them', () => {
    for (const name of ['credentialId', 'publicKey']) {
      expect(field(name)).toMatchObject({ access: serverOnlyFieldAccess, hidden: true })
    }
  })

  it('refuses every write on every field, admins included; only admins read the rest', () => {
    for (const f of named(Passkeys.fields)) {
      const access = (f as { access?: { create?: unknown; update?: unknown; read?: unknown } })
        .access
      expect(access?.create, `${f.name} create`).toBe(serverOnlyFieldAccess.create)
      expect(access?.update, `${f.name} update`).toBe(serverOnlyFieldAccess.update)
      expect([serverOnlyFieldAccess.read, isAdminFieldAccess], `${f.name} read`).toContain(
        access?.read,
      )
    }
  })

  it('has no hooks and no versions: deleting is a plain delete', () => {
    const collection: CollectionConfig = Passkeys
    expect(collection.hooks).toBeUndefined()
    expect(collection.versions).toBeUndefined()
  })
})
