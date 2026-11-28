import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CONFIG_FILE, taskReach, toolReach } from './reach.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-reach-')
const { write, load, root } = fixture
let program
let context

const KNOWN = new Set(['faq', 'events', 'posts', 'users'])
const FILE = 'src/modules/a/cms/tools.ts'
const collections = (found) => found.map((entry) => entry.collection)

beforeAll(() => {
  const api = 'type Api = { find(a: object): void }\ndeclare const req: { payload: Api }\n'
  write(
    FILE,
    `${api}type Slug = 'faq' | 'events' | 'posts' | 'users'
export const first = { name: 'first', slug: 'first', handler: () => req.payload.find({ collection: 'faq' }) }
export const makeSecond = ({ keepers }: { keepers: Array<() => void> }) => ({
  name: 'second',
  slug: 'second',
  handler: (slug: Slug) => {
    req.payload.find({ collection: 'events' })
    req.payload.find({ collection: slug })
    for (const keeper of keepers) keeper()
  },
})
export async function release() {
  req.payload.find({ collection: 'posts' })
}
`,
  )
  write(
    'src/modules/b/cms/keeper.ts',
    `${api}export const keeper = () => { req.payload.find({ collection: 'users' }) }\n`,
  )
  write(
    CONFIG_FILE,
    `import { makeSecond } from '@/modules/a/cms/tools'
import { keeper } from '@/modules/b/cms/keeper'
makeSecond({ keepers: [keeper] })
`,
  )
  program = load()
  context = { program, root }
}, 60_000)

afterAll(() => fixture.cleanup())

describe('toolReach', () => {
  const reach = (...args) => toolReach(context, KNOWN)(...args)

  it('starts at the tool of that name in the file, not at every handler there', () => {
    expect(collections(reach(FILE, 'first'))).toEqual(['faq'])
    expect(collections(reach(FILE, 'second'))).toEqual(['events'])
  })

  it('knows which collections exist, so a value that can be any of them names none', () => {
    expect(reach(FILE, 'second').length).toBe(1)
  })
})

describe('taskReach', () => {
  it('starts at the task of that name, or at the hook function when one is named', () => {
    const reach = (...args) => taskReach(context, KNOWN)(...args)
    // `users` comes from the keeper the config passes in, which any task of the file is credited with
    expect(collections(reach(FILE, 'first'))).toEqual(['faq', 'users'])
    expect(collections(reach(FILE, 'first', 'release'))).toEqual(['posts'])
  })

  it('follows the functions the config file passes into the task’s own code', () => {
    expect(CONFIG_FILE).toBe('src/payload.config.ts')
    expect(collections(taskReach(context, KNOWN)(FILE, 'second'))).toContain('users')
    expect(collections(taskReach(context, KNOWN, 'src/none.ts')(FILE, 'second'))).not.toContain(
      'users',
    )
  })

  it('knows which collections exist, so a value that can be any of them names none', () => {
    expect(collections(taskReach(context, KNOWN)(FILE, 'second'))).not.toContain('faq')
  })
})
