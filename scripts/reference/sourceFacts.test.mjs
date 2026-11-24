import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls, findDefinitions, operationsSuffix, ownerOf } from './sourceFacts.mjs'

let root
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}

const FILES = [
  'src/modules/events/cms/events.ts',
  'src/modules/agents/cms/agentRuns.ts',
  'src/modules/agents/cms/seed.ts',
  'src/modules/agents/cms/runs.test.ts',
  'src/platform/payload/media.ts',
  'src/modules/agents/cms/tools/report.ts',
  'src/modules/agents/cms/tools/helper.ts',
  'src/modules/news/cms/unrelated.ts',
  'src/modules/agents/cms/tools/viaHelper.ts',
]

function load() {
  return ts.createProgram({
    rootNames: FILES.map((file) => path.join(root, file)),
    options: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      baseUrl: root,
      paths: { '@/*': ['src/*'] },
    },
  })
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-source-facts-'))
  write(
    'src/modules/events/cms/events.ts',
    "export const Events = { slug: 'events', fields: [] }\n",
  )
  write(
    'src/modules/agents/cms/agentRuns.ts',
    "export const AGENT_RUNS = 'agent-runs'\nexport const AgentRuns = { slug: AGENT_RUNS, fields: [] }\n",
  )
  // A document with a slug, a seed and a test are not definitions of a content type
  write(
    'src/modules/agents/cms/seed.ts',
    "export const doc = { slug: 'events', title: 'Events' }\nexport const task = { slug: 'cleanup', handler: () => 1 }\n",
  )
  write(
    'src/modules/agents/cms/runs.test.ts',
    "export const fake = { slug: 'faked', fields: [] }\n",
  )
  write('src/platform/payload/media.ts', "export const Media = { slug: 'media', fields: [] }\n")
  write(
    'src/modules/agents/cms/tools/report.ts',
    `import { AGENT_RUNS } from '../agentRuns'
import { find } from './helper'
type Input = { collection: 'events' | 'posts' }
declare const req: { payload: { find(a: object): void; create(a: object): void; db: { deleteMany(a: object): void } } }
export function report(input: Input) {
  req.payload.create({ collection: input.collection, data: {} })
  req.payload.db.deleteMany({ collection: AGENT_RUNS })
  find()
}
`,
  )
  write(
    'src/modules/agents/cms/tools/helper.ts',
    `declare const req: { payload: { find(a: object): void } }
export function find() {
  req.payload.find({ collection: 'categories' })
}
`,
  )
  write(
    'src/modules/agents/cms/tools/viaHelper.ts',
    `import { AGENT_RUNS } from '../agentRuns'
declare function deleteRows(req: object, collection: string): void
declare function log(text: string): void
export function run(req: object) {
  deleteRows(req, AGENT_RUNS)
  log('events')
}
`,
  )
  write(
    'src/modules/news/cms/unrelated.ts',
    "declare const req: { payload: { find(a: object): void } }\nreq.payload.find({ collection: 'posts' })\n",
  )
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('findDefinitions', () => {
  it('maps each collection or global slug to the files that define it, reading constants', () => {
    const found = findDefinitions(load(), root)
    expect(found.get('events')).toEqual(['src/modules/events/cms/events.ts'])
    expect(found.get('agent-runs')).toEqual(['src/modules/agents/cms/agentRuns.ts'])
    expect(found.get('media')).toEqual(['src/platform/payload/media.ts'])
  })

  it('ignores documents, tasks and tests: only an object with fields defines a type', () => {
    const found = findDefinitions(load(), root)
    expect(found.get('events')).not.toContain('src/modules/agents/cms/seed.ts')
    expect(found.has('cleanup')).toBe(false)
    expect(found.has('faked')).toBe(false)
  })
})

describe('ownerOf', () => {
  it('names the module that holds the definition', () => {
    expect(ownerOf(['src/modules/events/cms/events.ts'])).toEqual({
      owner: 'module `events`',
      file: 'src/modules/events/cms/events.ts',
    })
  })

  it('names the shared area for a platform file', () => {
    expect(ownerOf(['src/platform/payload/media.ts']).owner).toBe('shared code `platform/payload`')
  })

  it('says a plugin or Payload when the repository does not define it', () => {
    expect(ownerOf([])).toEqual({ owner: 'a plugin or Payload', file: '' })
  })
})

describe('findCollectionCalls', () => {
  it('lists the collections and operations an entry file reaches, with its relative imports', () => {
    const calls = findCollectionCalls(load(), root, 'src/modules/agents/cms/tools/report.ts')
    expect(calls).toEqual([
      { collection: 'agent-runs', operations: ['delete'] },
      { collection: 'categories', operations: ['read'] },
      { collection: 'events', operations: ['create'] },
      { collection: 'posts', operations: ['create'] },
    ])
  })

  it('stays inside the entry file and the files it imports', () => {
    const calls = findCollectionCalls(load(), root, 'src/modules/agents/cms/tools/helper.ts')
    expect(calls).toEqual([{ collection: 'categories', operations: ['read'] }])
  })

  it('also follows a collection passed to a helper by name, with no operation known', () => {
    const known = new Set(['agent-runs', 'events'])
    const calls = findCollectionCalls(
      load(),
      root,
      'src/modules/agents/cms/tools/viaHelper.ts',
      known,
    )
    expect(calls).toEqual([{ collection: 'agent-runs', operations: [] }])
  })

  it('does not follow a plain string, or a name that is not a known collection', () => {
    expect(
      findCollectionCalls(load(), root, 'src/modules/agents/cms/tools/viaHelper.ts', new Set()),
    ).toEqual([])
  })
})

describe('operationsSuffix', () => {
  it('writes the operations in brackets, or nothing when none is known', () => {
    expect(operationsSuffix(['create', 'read'])).toBe(' (create, read)')
    expect(operationsSuffix([])).toBe('')
  })
})
