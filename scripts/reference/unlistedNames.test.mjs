/** Names that a list drives, with names outside the list: they follow it, or are left out (#1461). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { describeAccess, describeHooks } from '../content-types/callbacks.mjs'
import { findCollectionCalls } from './collectionCalls.mjs'
import { describeMcp } from './mcpTools.mjs'
import { createFixture } from './testProgram.mjs'

const fn = () => true
const schemaOf = () => ({ type: 'object', properties: {} })

describe('lists of names with a name outside them', () => {
  it('puts an access operation or hook phase that is not listed after the listed ones, by name', () => {
    const access = { zeta: fn, admin: fn, another: fn, create: fn }
    expect(describeAccess(access).map((entry) => entry.operation)).toEqual([
      'create',
      'admin',
      'another',
      'zeta',
    ])
    const hooks = { zeta: [fn], afterError: [fn], another: [fn], beforeValidate: [fn] }
    expect(describeHooks(hooks).map((entry) => entry.phase)).toEqual([
      'beforeValidate',
      'afterError',
      'another',
      'zeta',
    ])
  })

  it('makes a tool only for the operations the plugin has, switched on with true', () => {
    const options = {
      collections: {
        posts: {
          enabled: { find: true, upsert: true, create: 'yes', update: false, delete: true },
        },
      },
      globals: { header: { enabled: { find: true, create: true, delete: true, update: true } } },
    }
    const { collectionTools } = describeMcp(options, { schemaOf })
    expect(collectionTools.map((tool) => tool.name)).toEqual([
      'findPosts',
      'deletePosts',
      'findHeader',
      'updateHeader',
    ])
  })
})

const fixture = createFixture('reference-unlisted-')
let program

beforeAll(() => {
  fixture.write(
    'src/modules/agents/cms/tools/unlisted.ts',
    `declare const payload: Record<string, (a: object) => void>
export const tool = {
  name: 'unlisted',
  handler: () => {
    payload.upsert({ collection: 'events' })
    payload.sendEmail({ collection: 'posts' })
    payload.find({ collection: 'faq' })
    payload.findGlobal({ collection: 'notAGlobalSlug', slug: 'header' })
    payload.find({ slug: 'notACollection', collection: 'media' })
  },
}
`,
  )
  program = fixture.load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('findCollectionCalls with a method or key outside its lists', () => {
  it('counts only the calls it knows, a global by its slug and the rest by their collection', () => {
    const found = findCollectionCalls(
      program,
      fixture.root,
      'src/modules/agents/cms/tools/unlisted.ts',
      {
        name: 'unlisted',
      },
    )
    expect(found.map((entry) => [entry.collection, entry.operations])).toEqual([
      ['faq', ['read (access bypassed)']],
      ['header', ['read (access bypassed)']],
      ['media', ['read (access bypassed)']],
    ])
  })
})
