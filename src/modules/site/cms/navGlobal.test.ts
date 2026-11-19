import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cache = vi.hoisted(() => ({ expireCacheTag: vi.fn() }))
vi.mock('@/platform/payload/expireCacheTag', () => cache)

import { isAdminOrEditor } from '@/platform/payload/roles'

import { FORUM_DEFAULT_URL, validateForumUrl } from '../domain/forum'
import { Footer, Header } from './navGlobal'

const fieldNamed = (global: typeof Header, name: string) =>
  global.fields.find((field) => 'name' in field && field.name === name)

describe('the forum address (#485)', () => {
  it('is a footer field that starts with the neighborhood forum and must be https', () => {
    expect(fieldNamed(Footer, 'forumUrl')).toMatchObject({
      type: 'text',
      defaultValue: FORUM_DEFAULT_URL,
      validate: validateForumUrl,
    })
  })

  it('is not on the header', () => {
    expect(fieldNamed(Header, 'forumUrl')).toBeUndefined()
  })
})

beforeEach(() => cache.expireCacheTag.mockReset())

/** Runs a global's afterChange hooks the way Payload does after a save. */
const save = (global: typeof Header, context: Record<string, unknown> = {}) => {
  const req = { payload: { logger: { info: vi.fn() } }, context } as unknown as PayloadRequest
  for (const hook of global.hooks?.afterChange ?? []) {
    hook({ data: {}, doc: {}, previousDoc: {}, req, global: {} as never, context })
  }
}

describe.each([
  ['header', Header],
  ['footer', Footer],
])('the %s global', (slug, global) => {
  it('is readable by anyone and editable by staff only', () => {
    expect(global.slug).toBe(slug)
    expect(global.access?.update).toBe(isAdminOrEditor)
    expect(global.access?.read?.({} as never)).toBe(true)
  })

  it('labels each nav item row with the shared row label', () => {
    const navItems = global.fields.find((field) => 'name' in field && field.name === 'navItems')

    expect(navItems?.admin?.components).toMatchObject({
      RowLabel: '@/modules/site/cms/NavItemRowLabel.client#NavItemRowLabel',
    })
  })

  it('expires its own cache tag when saved', () => {
    save(global)

    expect(cache.expireCacheTag).toHaveBeenCalledExactlyOnceWith(`global_${slug}`)
  })

  it('leaves the cache alone when the save asks not to revalidate (the seed)', () => {
    save(global, { disableRevalidate: true })

    expect(cache.expireCacheTag).not.toHaveBeenCalled()
  })
})
