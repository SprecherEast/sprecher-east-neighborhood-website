import { describe, expect, it } from 'vitest'

import { buildImports, importSpecifiers, packageOf } from './imports.mjs'

describe('importSpecifiers', () => {
  it('finds static, dynamic and re-exported imports, leaving type-only text alone', () => {
    const text = [
      "import { a } from 'zod'",
      "import type { T } from '@/platform/lib/types'",
      "export * from './local'",
      "export { b } from 'react'",
      "const c = await import('@payloadcms/db-sqlite')",
      "import 'server-only'",
      "// import x from 'commented'",
    ].join('\n')
    expect(importSpecifiers(text)).toEqual([
      'zod',
      '@/platform/lib/types',
      './local',
      'react',
      '@payloadcms/db-sqlite',
      'server-only',
    ])
  })
})

describe('packageOf', () => {
  it('names the package of a specifier, and nothing for a local or built-in one', () => {
    expect(packageOf('zod')).toBe('zod')
    expect(packageOf('zod/v4')).toBe('zod')
    expect(packageOf('@payloadcms/db-sqlite')).toBe('@payloadcms/db-sqlite')
    expect(packageOf('@payloadcms/richtext-lexical/react')).toBe('@payloadcms/richtext-lexical')
    expect(packageOf('./x')).toBeNull()
    expect(packageOf('@/platform/lib')).toBeNull()
    expect(packageOf('node:fs')).toBeNull()
  })
})

const ownerOf = (file) => {
  const match = /^src\/(modules|platform)\/([^/]+)\//.exec(file)
  if (!match) return null
  const type = match[1] === 'modules' ? 'module' : 'platform-area'
  return { id: `${type}:${match[2]}`, top: `${type}:${match[2]}` }
}

describe('buildImports', () => {
  const sources = [
    {
      file: 'src/modules/events/ui/Card.tsx',
      text: "import { z } from 'zod'\nimport { x } from '@/platform/lib/getURL'",
    },
    {
      file: 'src/modules/events/domain/rule.ts',
      text: "import { z } from 'zod'\nimport { y } from '@/modules/news/server'",
    },
    {
      file: 'src/platform/lib/getURL.ts',
      text: "import { z } from 'zod'\nimport { a } from '@/platform/lib/other'",
    },
    {
      file: 'src/payload.config.ts',
      text: "import { sqliteAdapter } from '@payloadcms/db-sqlite'\nimport { Z } from '@/platform/ui/Z'",
    },
    { file: 'src/modules/events/ui/Card.test.tsx', text: "import { v } from 'vitest'" },
    { file: 'src/modules/events/ui/Card.stories.tsx', text: "import { s } from 'storybook'" },
    {
      file: 'src/platform/theme/testing/fontFaces.ts',
      text: "import { f } from 'font-tool'\nimport { n } from '@/modules/news/server'",
    },
    {
      file: 'src/modules/events/ui/Other.tsx',
      text: "import { l } from 'not-a-dependency'\nimport { t } from 'toString'",
    },
  ]
  const dependencies = {
    zod: '^4.1.0',
    '@payloadcms/db-sqlite': '3.91.0',
    unused: '1.0.0',
    vitest: '4.0.0',
    storybook: '9.0.0',
    'font-tool': '1.0.0',
  }
  const { nodes, edges } = buildImports({
    sources,
    dependencies,
    ownerOf,
    areaIds: ['module:events', 'module:news', 'platform-area:lib', 'platform-area:ui'],
    siteId: 'site:sprecher-east',
  })
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a library node of each runtime dependency the source imports, with its version', () => {
    expect(nodes.map((n) => n.id)).toEqual([
      'group:libraries',
      'library:@payloadcms/db-sqlite',
      'library:zod',
    ])
    expect(nodes[2]).toMatchObject({
      type: 'library',
      path: 'package.json',
      facts: [{ label: 'Version', value: '^4.1.0' }],
    })
  })

  it("has an area use a library, counting the files, and leaves out the area's own tests", () => {
    expect(edge('module:events', 'library:zod', 'uses')).toMatchObject({ count: 2 })
    expect(edge('platform-area:lib', 'library:zod', 'uses')).toMatchObject({ count: 1 })
    expect(edge('site:sprecher-east', 'library:@payloadcms/db-sqlite', 'uses')).toBeDefined()
  })

  it('ignores test, story and testing-folder files, so a test-only package is no library', () => {
    expect(nodes.map((n) => n.id)).not.toContain('library:vitest')
    expect(nodes.map((n) => n.id)).not.toContain('library:storybook')
    expect(nodes.map((n) => n.id)).not.toContain('library:font-tool')
    expect(edge('platform-area:theme', 'module:news', 'uses')).toBeUndefined()
  })

  it('makes a library only of a package that package.json lists, by its own name', () => {
    expect(nodes.map((n) => n.id)).not.toContain('library:not-a-dependency')
    expect(nodes.map((n) => n.id)).not.toContain('library:toString')
  })

  it('has an area use the platform area or module it imports, but not itself', () => {
    expect(edge('module:events', 'platform-area:lib', 'uses')).toBeDefined()
    expect(edge('module:events', 'module:news', 'uses')).toBeDefined()
    expect(edge('platform-area:lib', 'platform-area:lib', 'uses')).toBeUndefined()
  })

  it('holds the libraries in a group under the site', () => {
    expect(edge('site:sprecher-east', 'group:libraries', 'contains')).toBeDefined()
    expect(edge('group:libraries', 'library:zod', 'contains')).toBeDefined()
  })

  it('does not count the site root as using an area', () => {
    expect(edge('site:sprecher-east', 'platform-area:ui', 'uses')).toBeUndefined()
  })
})
