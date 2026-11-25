import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls } from './collectionCalls.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-collection-receivers-')
const { write, load, root } = fixture
let program

beforeAll(() => {
  write(
    'src/modules/agents/cms/tools/receivers.ts',
    `type Api = { find(a: object): void; db: { count(a: object): void } }
declare const req: { payload: Api; other: Api }
declare const cache: Api
declare const payload: Api
export const tool = {
  name: 'receivers',
  handler: () => {
    payload.find({ collection: 'events' })
    req.payload.find({ collection: 'posts' })
    req.payload.db.count({ collection: 'faq' })
    cache.find({ collection: 'categories' })
    req.other.find({ collection: 'media' })
    cache.db.count({ collection: 'redirects' })
    notDeclaredAnywhere()
  },
}
`,
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('findCollectionCalls receivers (#1461)', () => {
  it('counts only calls made on Payload, directly or through the request, and on its database', () => {
    const found = findCollectionCalls(program, root, 'src/modules/agents/cms/tools/receivers.ts', {
      name: 'receivers',
      knownSlugs: new Set(),
    })
    expect(found.map((entry) => entry.collection)).toEqual(['events', 'faq', 'posts'])
  })
})
