import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  areaOf,
  findDefinitions,
  findPluginConfigurers,
  findServerActions,
  ownerOf,
} from './sourceFacts.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-source-facts-')
const { write, load, root } = fixture

beforeAll(() => {
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
  // Shorthand `slug`, as a factory that spreads one value into two types writes it
  write(
    'src/modules/site/cms/nav.ts',
    "const slug = 'header'\nexport const Header = { slug, fields: [] }\n",
  )
  write('src/platform/payload/media.ts', "export const Media = { slug: 'media', fields: [] }\n")
  write(
    'src/modules/accounts/actions.ts',
    `'use server'
export async function signIn() {}
export const signOut = async () => {}
export const LIMIT = 3
function internal() {}
`,
  )
  write(
    'src/payload.config.ts',
    [
      "import { formPlugin } from '@payloadcms/plugin-x'",
      "import { otherPlugin } from '@payloadcms/plugin-y'",
      "import { createOptions } from '@/modules/contact/cms'",
      "import { confirmer } from '@/modules/verification/cms'",
      "import { TOKEN } from '@/platform/lib'",
      'export const plugins = [',
      '  formPlugin(createOptions({ confirmer })),',
      '  otherPlugin({ token: TOKEN }),',
      ']',
    ].join('\n'),
  )
  write('src/modules/accounts/plain.ts', 'export async function notAnAction() {}\n')
  write(
    'src/app/(payload)/layout.tsx',
    `export const serverFunction = async function (args: object) {
  'use server'
  return args
}
export default function Layout() { return null }
`,
  )
})

afterAll(() => fixture.cleanup())

describe('findDefinitions', () => {
  it('maps each collection or global slug to the files that define it, reading constants', () => {
    const found = findDefinitions(load(), root)
    expect(found.get('events')).toEqual(['src/modules/events/cms/events.ts'])
    expect(found.get('agent-runs')).toEqual(['src/modules/agents/cms/agentRuns.ts'])
    expect(found.get('media')).toEqual(['src/platform/payload/media.ts'])
  })

  it('reads a shorthand `slug` property', () => {
    expect(findDefinitions(load(), root).get('header')).toEqual(['src/modules/site/cms/nav.ts'])
  })

  it('ignores documents, tasks and tests: only an object with fields defines a type', () => {
    const found = findDefinitions(load(), root)
    expect(found.get('events')).not.toContain('src/modules/agents/cms/seed.ts')
    expect(found.has('cleanup')).toBe(false)
    expect(found.has('faked')).toBe(false)
  })
})

describe('areaOf and ownerOf', () => {
  it('names the module that holds the file, or the shared area, or the app', () => {
    expect(areaOf('src/modules/events/cms/events.ts')).toBe('module `events`')
    expect(areaOf('src/platform/payload/media.ts')).toBe('shared code `platform/payload`')
    expect(areaOf('src/app/(payload)/layout.tsx')).toBe('the app folder `src/app`')
  })

  it('names the owner of a content type from the file that defines it', () => {
    expect(ownerOf(['src/modules/events/cms/events.ts'])).toEqual({
      owner: 'module `events`',
      file: 'src/modules/events/cms/events.ts',
    })
  })

  it('says a plugin or Payload when the repository does not define it', () => {
    expect(ownerOf([])).toEqual({ owner: 'a plugin or Payload', file: '' })
  })
})

describe('findServerActions', () => {
  it('lists exported functions of a "use server" file and an inline server function', () => {
    expect(findServerActions(load(), root)).toEqual([
      {
        file: 'src/app/(payload)/layout.tsx',
        name: 'serverFunction',
        area: 'the app folder `src/app`',
      },
      { file: 'src/modules/accounts/actions.ts', name: 'signIn', area: 'module `accounts`' },
      { file: 'src/modules/accounts/actions.ts', name: 'signOut', area: 'module `accounts`' },
    ])
  })
})

describe('findPluginConfigurers', () => {
  it('maps a plugin to the modules whose code is in the options it is called with', () => {
    expect(findPluginConfigurers(load(), root, 'src/payload.config.ts')).toEqual(
      new Map([
        ['@payloadcms/plugin-x', ['contact', 'verification']],
        ['@payloadcms/plugin-y', []],
      ]),
    )
  })
})
