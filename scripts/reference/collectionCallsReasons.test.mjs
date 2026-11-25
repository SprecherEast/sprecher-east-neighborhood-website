import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls } from './collectionCalls.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-collection-reasons-')
const { write, load, root } = fixture
let program

const PAYLOAD = `declare const req: { payload: { find(a: object): void; create(a: object): void; db: { deleteMany(a: object): void } } }\n`

beforeAll(() => {
  write(
    'src/modules/agents/cms/tools/reasons.ts',
    `${PAYLOAD}/** Clears the run's rows directly: no one is signed in on a schedule. */
function viaDatabase() {
  req.payload.db.deleteMany({ collection: 'agent-runs' })
}
/** Looks the event up with the default access: the server is the caller. A second one. */
function byDefault() {
  req.payload.find({ collection: 'events' })
}
/** Reads as the signed-in agent: the collection's own rules apply. */
function checked() {
  req.payload.find({ collection: 'posts', overrideAccess: false })
}
/** The doc comment wins over a plain one after it. */
/* A plain note, not a doc comment. */
function plainAfter() {
  req.payload.find({ collection: 'users', overrideAccess: true })
}
/**
   * Deeper indent one.
      * and two.
 */
function indented() {
  req.payload.find({ collection: 'media', overrideAccess: true })
}
/** Rounds a * b up: the star in the text stays. */
function withStar() {
  req.payload.find({ collection: 'faq', overrideAccess: true })
}
export const reasons = { name: 'reasons', handler: () => { viaDatabase(); byDefault(); checked(); withStar(); plainAfter(); indented() } }
`,
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('findCollectionCalls reasons (#1461)', () => {
  it('quotes the comment wherever access is bypassed, and nowhere it is checked', () => {
    const found = findCollectionCalls(program, root, 'src/modules/agents/cms/tools/reasons.ts', {
      name: 'reasons',
      knownSlugs: new Set(['agent-runs', 'events', 'posts', 'faq', 'users', 'media']),
    })
    expect(found).toEqual([
      {
        collection: 'agent-runs',
        operations: ['delete (access bypassed)'],
        why: [
          {
            operation: 'delete',
            text: "Clears the run's rows directly: no one is signed in on a schedule.",
          },
        ],
      },
      {
        collection: 'events',
        operations: ['read (access bypassed)'],
        why: [
          {
            operation: 'read',
            text: 'Looks the event up with the default access: the server is the caller. A second one.',
          },
        ],
      },
      {
        collection: 'faq',
        operations: ['read (access bypassed)'],
        why: [{ operation: 'read', text: 'Rounds a * b up: the star in the text stays.' }],
      },
      {
        collection: 'media',
        operations: ['read (access bypassed)'],
        why: [{ operation: 'read', text: 'Deeper indent one. and two.' }],
      },
      { collection: 'posts', operations: ['read (access checked)'], why: [] },
      {
        collection: 'users',
        operations: ['read (access bypassed)'],
        why: [{ operation: 'read', text: 'The doc comment wins over a plain one after it.' }],
      },
    ])
  })
})
