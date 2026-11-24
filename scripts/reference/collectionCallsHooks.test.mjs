import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls } from './collectionCalls.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-collection-hooks-')
const { write, load, root } = fixture
let program

beforeAll(() => {
  write(
    'src/platform/payload/hooks.ts',
    `type Api = { count(a: object): void; updateMany(a: object): void; db: Api }
declare const req: { payload: Api }
/** Sets stuck rows back. Only counts first. Then updates them. A fourth sentence. */
export async function release() {
  await req.payload.db.count({ collection: 'payload-jobs' })
  await req.payload.db.updateMany({ collection: 'payload-jobs', overrideAccess: true })
}
export const arrow = async () => {
  await req.payload.count({ collection: 'events' })
}
export function release2() {}
export const notAFunction = 3
export const task = { slug: 'other', handler: async () => { await req.payload.count({ collection: 'faq' }) } }
`,
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('findCollectionCalls from a named hook (#1461)', () => {
  const calls = (hook) =>
    findCollectionCalls(program, root, 'src/platform/payload/hooks.ts', {
      hook,
      knownSlugs: new Set(['payload-jobs', 'events', 'faq']),
    })

  it('starts at the function of that name: a declaration or a const that holds a function', () => {
    expect(calls('release').map((c) => [c.collection, c.operations])).toEqual([
      ['payload-jobs', ['read (access bypassed)', 'update (access bypassed)']],
    ])
    expect(calls('arrow').map((c) => c.collection)).toEqual(['events'])
    expect(calls('release2')).toEqual([])
    expect(calls('notAFunction')).toEqual([])
    expect(calls('missing')).toEqual([])
  })

  it('does not start at a task handler in the same file', () => {
    expect(calls('release').map((c) => c.collection)).not.toContain('faq')
  })

  it('cuts the quoted comment after two sentences and marks the cut', () => {
    const [found] = calls('release')
    expect(found.why[0].text).toBe('Sets stuck rows back. Only counts first. …')
  })
})
