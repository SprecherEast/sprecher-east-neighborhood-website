/**
 * A small repository for the test of the entry script (#1461): two content types, one endpoint,
 * one AI agent tool, one job and one timed workflow, so a run loads in seconds. The generator
 * code and the shared scripts are copied from the real repository, which it runs unchanged.
 */
import fs from 'node:fs'
import path from 'node:path'

const GENERATOR = ['scripts/generate-reference.mjs', 'scripts/content-types', 'scripts/reference']
const REAL_FILES = [
  'package.json',
  'tsconfig.json',
  'docs/ui',
  'src/platform/payload/testing/accessHarness.ts',
]

const SOURCES = {
  'src/payload.config.ts': `import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig } from 'payload'

import { Events } from '@/modules/events/cms/Events'
import { ping } from '@/modules/events/cms/ping'
import { retentionTask } from '@/modules/events/cms/retention'

export default buildConfig({
  secret: 'fixture-secret',
  db: sqliteAdapter({ client: { url: 'file::memory:' } }),
  collections: [Events, { slug: 'users', auth: true, fields: [] }],
  globals: [{ slug: 'header', fields: [{ name: 'label', type: 'text' }] }],
  endpoints: [{ path: '/ping', method: 'get', handler: ping }],
  jobs: {
    access: { run: () => true },
    tasks: [retentionTask],
    autoRun: [{ cron: '0 * * * *', queue: 'retention' }],
  },
})
`,
  'src/modules/events/cms/Events.ts': `const isPublic = () => true
export const Events = {
  slug: 'events',
  access: { read: isPublic },
  fields: [{ name: 'title', type: 'text' }],
}
`,
  'src/modules/events/cms/ping.ts': `export const ping = () => Response.json({ ok: true })\n`,
  'src/modules/events/cms/retention.ts': `declare const payload: { delete(a: object): Promise<void> }
export const retentionTask = {
  slug: 'retain',
  schedule: [{ cron: '0 * * * *', queue: 'retention' }],
  handler: async () => {
    await payload.delete({ collection: 'events', where: {}, overrideAccess: true })
    return { output: {} }
  },
}
`,
  'src/modules/agents/cms.ts': `import { z } from 'zod'

declare function touch(collection: string): void
const EVENTS = 'events'

export const mcpOptions = {
  collections: { events: { enabled: { find: true }, description: 'Events.' } },
  mcp: {
    tools: [
      {
        name: 'echo',
        description: 'Says it back.',
        handler: async () => {
          touch(EVENTS)
          return { content: [] }
        },
        parameters: { text: z.string().max(20).describe('What to say') },
      },
    ],
  },
}
`,
  'src/app/(frontend)/page.tsx': `export default function Page() {\n  return null\n}\n`,
  'src/app/(payload)/admin/[[...segments]]/page.tsx': `export default function Admin() {\n  return null\n}\n`,
  'src/app/(payload)/api/[...slug]/route.ts': `export const GET = () => new Response('')\n`,
  '.github/workflows/nightly.yml': `name: Nightly
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`,
  '.github/dependabot.yml': `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
`,
  'intelligence/pipeline.yaml': `schedule:
  cron: '0 5 * * *'
  timezone: America/Chicago
`,
  'ops/cron.sh': `#!/bin/sh\necho "0 3 * * * /bin/true"\n`,
}

const skipTests = (source) => !/\.test\.mjs$|__snapshots__/.test(source)

/** Builds the repository in `root`, with the real `node_modules` linked, and returns `root`. */
export function buildEntryFixture(repoRoot, root) {
  for (const entry of [...GENERATOR, ...REAL_FILES]) {
    fs.mkdirSync(path.dirname(path.join(root, entry)), { recursive: true })
    fs.cpSync(path.join(repoRoot, entry), path.join(root, entry), {
      recursive: true,
      filter: skipTests,
    })
  }
  for (const [file, text] of Object.entries(SOURCES)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  // The fixture has no shared components, so there are no groups to name them in
  fs.writeFileSync(
    path.join(root, 'scripts/reference/componentGroups.mjs'),
    'export const COMPONENT_GROUPS = []\n',
  )
  fs.mkdirSync(path.join(root, 'docs/reference'), { recursive: true })
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'))
  return root
}
