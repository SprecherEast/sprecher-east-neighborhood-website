import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { resolverFor, safeKitFiles } from './kitFiles.mjs'

const UI = 'src/platform/ui'
/** A made-up repository: file name to text. A module of ours resolves by name; the rest are packages. */
const resolver = (repo) => (specifier, from) => {
  if (specifier.startsWith('@/')) {
    const path = `src/${specifier.slice(2)}`
    return [`${path}.tsx`, `${path}.ts`].find((p) => p in repo)
  }
  if (specifier.startsWith('./')) {
    const path = `${from.replace(/\/[^/]*$/, '')}/${specifier.slice(2)}`
    return [`${path}.tsx`, `${path}.ts`].find((p) => p in repo)
  }
  return null
}
const safe = (repo) =>
  safeKitFiles({
    files: Object.keys(repo),
    readFile: (file) => repo[file],
    resolve: resolver(repo),
  })

describe('safeKitFiles: the kit files an example may import', () => {
  it('lists the kit component files, and nothing that is not one', () => {
    const repo = {
      [`${UI}/Button.tsx`]: "import { cva } from 'class-variance-authority'",
      [`${UI}/Tabs.client.tsx`]: "'use client'",
      [`${UI}/chart/Bar.tsx`]: '',
      [`${UI}/Button.test.tsx`]: '',
      [`${UI}/Button.stories.tsx`]: '',
      [`${UI}/Button.examples.tsx`]: '',
      [`${UI}/testing/renderServer.tsx`]: '',
      [`${UI}/cn.ts`]: '',
      'src/platform/richtext/RichText.tsx': '',
    }
    expect([...safe(repo)].sort()).toEqual([
      `${UI}/Button.tsx`,
      `${UI}/Tabs.client.tsx`,
      `${UI}/chart/Bar.tsx`,
    ])
  })

  it('drops a file that imports the Payload admin, a server package or a node module', () => {
    for (const specifier of [
      '@payloadcms/admin-bar',
      '@payloadcms/live-preview-react',
      'payload',
      'payload/shared',
      'server-only',
      'next/headers',
      'node:fs',
      'fs',
    ]) {
      const repo = { [`${UI}/A.tsx`]: `import x from '${specifier}'`, [`${UI}/B.tsx`]: '' }
      expect([...safe(repo)], specifier).toEqual([`${UI}/B.tsx`])
    }
  })

  it('drops a file that reads process, and one that only re-exports or loads one that does', () => {
    const repo = {
      [`${UI}/A.tsx`]: 'export const a = process.env.X',
      [`${UI}/B.tsx`]: "export { b } from './A'",
      [`${UI}/C.tsx`]: "export const load = () => import('./A')",
      [`${UI}/D.tsx`]: "const a = require('./A')",
      [`${UI}/E.tsx`]: 'export const e = 1',
    }
    expect([...safe(repo)]).toEqual([`${UI}/E.tsx`])
  })

  it('follows imports all the way down, through other folders and around a cycle', () => {
    const repo = {
      [`${UI}/A.tsx`]: "import { url } from '@/platform/lib/getURL'",
      'src/platform/lib/getURL.ts': "import { env } from './env'\nexport const url = env",
      'src/platform/lib/env.ts': 'export const env = process.env.URL',
      [`${UI}/B.tsx`]: "import { c } from './C'",
      [`${UI}/C.tsx`]: "import { b } from './B'\nimport { p } from '@/platform/payload/roles'",
      'src/platform/payload/roles.ts': '',
      [`${UI}/D.tsx`]: "import { d } from './E'",
      [`${UI}/E.tsx`]: "import { d } from './D'",
    }
    expect([...safe(repo)].sort()).toEqual([`${UI}/D.tsx`, `${UI}/E.tsx`])
  })

  it('drops a file that imports a server folder, and one it cannot find', () => {
    for (const path of [
      '@/modules/news/data/posts',
      '@/platform/service/email',
      '@/app/layout',
      '@/missing/thing',
    ]) {
      const repo = {
        [`${UI}/A.tsx`]: `import x from '${path}'`,
        'src/modules/news/data/posts.ts': '',
        'src/platform/service/email.ts': '',
        'src/app/layout.tsx': '',
      }
      expect([...safe(repo)], path).toEqual([])
    }
  })

  it('does not mind a type-only import or a property called process', () => {
    const repo = {
      [`${UI}/A.tsx`]:
        "import type { Config } from 'payload'\nexport type { X } from 'payload'\nexport const a = o.process",
    }
    expect([...safe(repo)]).toEqual([`${UI}/A.tsx`])
  })
})

describe('safeKitFiles: on this repository', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options
  const files = fs
    .readdirSync(path.join(root, 'src/platform'), { recursive: true })
    .map((file) => `src/platform/${String(file).split(path.sep).join('/')}`)
  const safe = safeKitFiles({
    files,
    readFile: (file) =>
      fs.existsSync(path.join(root, file))
        ? fs.readFileSync(path.join(root, file), 'utf8')
        : undefined,
    resolve: resolverFor(root, options),
  })

  it('keeps the plain components and drops the ones that reach the admin, live preview or the URL helpers', () => {
    expect(safe.has('src/platform/ui/Button.tsx')).toBe(true)
    for (const file of ['AdminBar.client', 'LivePreviewListener.client', 'Breadcrumbs', 'Media']) {
      expect(safe.has(`src/platform/ui/${file}.tsx`), file).toBe(false)
    }
    expect([...safe].filter((file) => /\/testing\/|\.(test|stories)\./.test(file))).toEqual([])
  })
})
