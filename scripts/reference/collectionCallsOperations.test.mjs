import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls } from './collectionCalls.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-collection-operations-')
const { write, load, root } = fixture
let program

const READS = ['find', 'findByID', 'findOne', 'count', 'findVersions', 'findVersionByID']
const WRITES = {
  create: ['create', 'duplicate'],
  update: ['update', 'updateOne', 'updateMany', 'restoreVersion'],
  delete: ['delete', 'deleteOne', 'deleteMany'],
}

const callsFor = (methods, slug) =>
  methods.map((method) => `    payload.${method}({ collection: '${slug}' })`).join('\n')

beforeAll(() => {
  write(
    'src/modules/agents/cms/tools/operations.ts',
    `declare const payload: Record<string, (a: object) => void>
export const tool = {
  name: 'operations',
  handler: () => {
${callsFor(READS, 'reads')}
${callsFor(WRITES.create, 'creates')}
${callsFor(WRITES.update, 'updates')}
${callsFor(WRITES.delete, 'deletes')}
    payload.findGlobal({ slug: 'siteGlobal' })
    payload.findGlobalVersions({ slug: 'versionsGlobal' })
    payload.updateGlobal({ slug: 'writtenGlobal' })
  },
}
/**
 * Aardvark note
 *   spans lines.
 */
function aardvark() {
  payload.update({ collection: 'zeta', overrideAccess: true })
}
/** Beta note. */
function beta() {
  payload.find({ collection: 'zeta', overrideAccess: true })
}
/** Alpha note. */
function alpha() {
  payload.find({ collection: 'zeta', overrideAccess: true })
}
export const bySlug = {
  slug: 'picked',
  handler: () => {
    payload.find({ collection: 'chosen' })
  },
}
export const notPicked = {
  slug: 'skipped',
  handler: () => {
    payload.find({ collection: 'left' })
  },
}
export const other = {
  name: 'other',
  handler: () => {
    aardvark()
    beta()
    alpha()
  },
}
`,
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('findCollectionCalls operations (#1461)', () => {
  const found = () =>
    findCollectionCalls(program, root, 'src/modules/agents/cms/tools/operations.ts', {
      name: 'operations',
      knownSlugs: new Set(),
    })

  it('lists the reasons for a bypass by operation, then by wording', () => {
    const [entry] = findCollectionCalls(
      program,
      root,
      'src/modules/agents/cms/tools/operations.ts',
      {
        name: 'other',
        knownSlugs: new Set(),
      },
    )
    expect(entry.why).toEqual([
      { operation: 'read', text: 'Alpha note.' },
      { operation: 'read', text: 'Beta note.' },
      { operation: 'update', text: 'Aardvark note spans lines.' },
    ])
  })

  it('starts at the handler named by its slug as well as by its name', () => {
    const calls = findCollectionCalls(program, root, 'src/modules/agents/cms/tools/operations.ts', {
      name: 'picked',
      knownSlugs: new Set(),
    })
    expect(calls.map((entry) => entry.collection)).toEqual(['chosen'])
  })

  it('files every call under the access it needs, a global by its slug', () => {
    const byName = Object.fromEntries(found().map((e) => [e.collection, e.operations]))
    expect(byName).toEqual({
      reads: ['read (access bypassed)'],
      creates: ['create (access bypassed)'],
      updates: ['update (access bypassed)'],
      deletes: ['delete (access bypassed)'],
      siteGlobal: ['read (access bypassed)'],
      versionsGlobal: ['read (access bypassed)'],
      writtenGlobal: ['update (access bypassed)'],
    })
  })
})
