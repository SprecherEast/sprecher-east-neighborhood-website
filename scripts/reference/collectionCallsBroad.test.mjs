import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls } from './collectionCalls.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-collection-broad-')
const { write, load, root } = fixture
let program

const KNOWN = new Set(['agent-runs', 'events', 'posts', 'faq'])
const calls = (file, name) => findCollectionCalls(program, root, file, { name, knownSlugs: KNOWN })

beforeAll(() => {
  write('src/modules/agents/cms/agentRuns.ts', "export const AGENT_RUNS = 'agent-runs'\n")
  // A value that can be any collection, given to a payload call and to a helper, names none
  write(
    'src/modules/agents/cms/tools/broad.ts',
    `type Slug = 'agent-runs' | 'events' | 'posts' | 'faq'
declare const req: { payload: { find(a: object): void } }
declare function helper(collection: Slug): void
export const task = {
  slug: 'broad',
  handler: (slug: Slug) => {
    req.payload.find({ collection: slug })
    helper(slug)
  },
}
`,
  )
  // A parameter handed on from one function to the next keeps what the first call bound it to
  write(
    'src/modules/agents/cms/tools/forwarded.ts',
    `import { AGENT_RUNS } from '../agentRuns'
type Slug = 'agent-runs' | 'events' | 'posts' | 'faq'
declare const req: { payload: { db: { deleteMany(a: object): void } } }
function inner(collection: Slug) {
  req.payload.db.deleteMany({ collection })
}
function outer(collection: Slug) {
  inner(collection)
}
export const task = { slug: 'forwarded', handler: () => outer(AGENT_RUNS) }
`,
  )
  // a function written outside `src/` is not followed
  write(
    'lib/outside.ts',
    `declare const payload: { find(a: object): void }
export function outside() {
  payload.find({ collection: 'faq' })
}
`,
  )
  write(
    'src/modules/agents/cms/tools/viaOutside.ts',
    `import { outside } from '../../../../../lib/outside'
export const task = { slug: 'viaOutside', handler: () => outside() }
`,
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('findCollectionCalls with a value that is not one collection (#1461)', () => {
  it('credits none, to a payload call or to a helper', () => {
    expect(calls('src/modules/agents/cms/tools/broad.ts', 'broad')).toEqual([])
  })

  it('does not follow a call into a function written outside src', () => {
    expect(calls('src/modules/agents/cms/tools/viaOutside.ts', 'viaOutside')).toEqual([])
  })

  it('follows a parameter through two functions to the collection the first call passed', () => {
    expect(calls('src/modules/agents/cms/tools/forwarded.ts', 'forwarded')).toEqual([
      { collection: 'agent-runs', operations: ['delete (access bypassed)'], why: [] },
    ])
  })
})
