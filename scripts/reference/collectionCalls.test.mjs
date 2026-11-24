import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls, operationsSuffix } from './collectionCalls.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-collection-calls-')
const { write, load, root } = fixture

const PAYLOAD = `declare const req: { payload: { find(a: object): void; create(a: object): void; update(a: object): void; db: { deleteMany(a: object): void } } }\n`

beforeAll(() => {
  write(
    'src/modules/agents/cms/agentRuns.ts',
    "export const AGENT_RUNS = 'agent-runs'\nexport const AgentRuns = { slug: AGENT_RUNS, fields: [] }\n",
  )
  // A document with a slug, a seed and a test are not definitions of a content type
  write(
    'src/modules/agents/cms/tools/report.ts',
    `import { AGENT_RUNS } from '../agentRuns'
import { find } from './helper'
${PAYLOAD}type Input = { collection: 'events' | 'posts' }
/** Counts as a doc comment of the function; the first sentences say why. Not this one. */
function bypassing() {
  req.payload.find({ collection: 'categories', overrideAccess: true })
}
/**
 * Read with access bypassed: drafts are hidden from the agent. Only the id goes back. A third sentence.
 */
function duplicate(input: Input) {
  req.payload.find({ collection: input.collection, overrideAccess: true })
}
function depends(flag: boolean) {
  req.payload.update({ collection: 'faq', overrideAccess: flag })
}
export function report(input: Input) {
  req.payload.create({ collection: input.collection, data: {}, overrideAccess: false })
  req.payload.db.deleteMany({ collection: AGENT_RUNS })
  find()
  duplicate(input)
  depends(true)
}
// Another function in the same file that the tool never calls
export function unused() {
  req.payload.update({ collection: 'media' })
}
export const reportTool = { name: 'report', handler: (input: Input) => report(input) }
export const otherTool = { name: 'other', handler: () => bypassing() }
`,
  )
  write(
    'src/modules/agents/cms/tools/helper.ts',
    `${PAYLOAD}export function find() {
  req.payload.find({ collection: 'categories' })
}
`,
  )
  write(
    'src/modules/agents/cms/tools/viaHelper.ts',
    `import { AGENT_RUNS } from '../agentRuns'
declare function deleteRows(req: object, collection: string): void
declare function log(text: string): void
export const task = {
  slug: 'viaHelper',
  handler: (req: object) => {
    deleteRows(req, AGENT_RUNS)
    log('events')
  },
}
`,
  )
  write(
    'src/modules/agents/cms/tools/shorthand.ts',
    `${PAYLOAD}const collection = 'events'
export const tool = {
  name: 'shorthand',
  handler: () => req.payload.find({ collection, overrideAccess: false }),
}
`,
  )
  write(
    'src/modules/agents/cms/tools/generic.ts',
    `import { AGENT_RUNS } from '../agentRuns'
type Slug = 'agent-runs' | 'events' | 'posts' | 'faq'
declare const req: { payload: { db: { deleteMany(a: object): void } } }
function deleteRows(collection: Slug) {
  req.payload.db.deleteMany({ collection })
}
export const task = { slug: 'generic', handler: () => deleteRows(AGENT_RUNS) }
`,
  )
})

afterAll(() => fixture.cleanup())

describe('findCollectionCalls', () => {
  const calls = (file, name, known = new Set()) =>
    findCollectionCalls(load(), root, file, { name, knownSlugs: known })

  it('follows the calls from the handler, and marks whether access is checked', () => {
    const found = calls('src/modules/agents/cms/tools/report.ts', 'report').map((c) => [
      c.collection,
      c.operations,
    ])
    expect(found).toEqual([
      ['agent-runs', ['delete (access bypassed)']],
      ['categories', ['read (access bypassed)']],
      ['events', ['create (access checked)', 'read (access bypassed)']],
      ['faq', ['update (access depends on a value)']],
      ['posts', ['create (access checked)', 'read (access bypassed)']],
    ])
  })

  it('leaves out what the same file does elsewhere, and what other handlers in it do', () => {
    const found = calls('src/modules/agents/cms/tools/report.ts', 'report').map((c) => c.collection)
    expect(found).not.toContain('media')
    expect(calls('src/modules/agents/cms/tools/report.ts', 'other')).toEqual([
      {
        collection: 'categories',
        operations: ['read (access bypassed)'],
        why: [
          {
            operation: 'read',
            text: 'Counts as a doc comment of the function; the first sentences say why. Not this one.',
          },
        ],
      },
    ])
  })

  it('says why, from the comment of the function, only where access is explicitly bypassed', () => {
    const [events] = calls('src/modules/agents/cms/tools/report.ts', 'report').filter(
      (c) => c.collection === 'events',
    )
    expect(events.why).toEqual([
      {
        operation: 'read',
        text: 'Read with access bypassed: drafts are hidden from the agent. Only the id goes back.',
      },
    ])
  })

  it('reads a shorthand `collection` property', () => {
    expect(calls('src/modules/agents/cms/tools/shorthand.ts', 'shorthand')).toEqual([
      { collection: 'events', operations: ['read (access checked)'], why: [] },
    ])
  })

  it('also follows a collection passed to a helper by name, with no operation known', () => {
    const known = new Set(['agent-runs', 'events'])
    expect(calls('src/modules/agents/cms/tools/viaHelper.ts', 'viaHelper', known)).toEqual([
      { collection: 'agent-runs', operations: [], why: [] },
    ])
    expect(calls('src/modules/agents/cms/tools/viaHelper.ts', 'viaHelper')).toEqual([])
  })
})

describe('findCollectionCalls, a call that takes any collection', () => {
  it('is credited to the collection the caller names, not to every collection', () => {
    const known = new Set(['agent-runs', 'events', 'posts', 'faq'])
    const found = findCollectionCalls(load(), root, 'src/modules/agents/cms/tools/generic.ts', {
      name: 'generic',
      knownSlugs: known,
    })
    expect(found).toEqual([{ collection: 'agent-runs', operations: [], why: [] }])
  })
})

describe('operationsSuffix', () => {
  it('writes the operations in brackets, or nothing when none is known', () => {
    expect(operationsSuffix(['create', 'read'])).toBe(' (create, read)')
    expect(operationsSuffix([])).toBe('')
  })
})
