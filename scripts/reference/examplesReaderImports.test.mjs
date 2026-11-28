import { describe, expect, it } from 'vitest'

import { readExamples as readWith } from './examplesReader.mjs'
import { FILE, IMPORTS, read, readExamples, withBody } from './examplesFixture.mjs'

describe('readExamples: what an example may import', () => {
  const importing = (line) => () =>
    readExamples(`${line}\n${IMPORTS}${withBody('render: () => null')}`, FILE)

  it('accepts react, lucide-react, the kit and the component files beside it', () => {
    for (const line of [
      "import React from 'react'",
      "import { ArrowRight } from 'lucide-react'",
      "import { Button } from '@/platform/ui/Button'",
      "import { BarTrack } from '@/platform/ui/chart/BarTrack'",
      "import type { ButtonProps } from '@/platform/ui/Button'",
      "import { Tabs } from './Tabs.client'",
    ]) {
      expect(importing(line), line).not.toThrow()
    }
  })

  it('refuses everything else, by default', () => {
    for (const line of [
      "import { getPayload } from 'payload'",
      "import { x } from 'payload/shared'",
      "import config from '@payload-config'",
      "import { findPosts } from '@/modules/news'",
      "import { y } from '@/platform/service/email'",
      "import { y } from '@/platform/lib/cn'",
      "import { y } from '@/platform/richtext/RichText'",
      "import { y } from '@/platform/uikit/x'",
      "import { headers } from 'next/headers'",
      "import { headers } from 'next/headers.js'",
      "import { c } from 'next/cache'",
      "import 'server-only'",
      "import fs from 'node:fs'",
      "import cp from 'child_process'",
      "import { n } from '../../modules/news/data/posts'",
      "import { r } from './payload/roles'",
      "import { h } from './helper'",
      "import { h } from './Thing.test'",
      "import { h } from './Other.stories'",
      "import { h } from '../ui/Button'",
    ]) {
      expect(importing(line), line).toThrow(/imports .*; an examples file may import only/)
    }
  })

  it('refuses a kit specifier that walks out of the kit or names a file that is not a safe component', () => {
    for (const line of [
      "import { x } from '@/platform/ui/../../modules/accounts/cms/x'",
      "import x from '@/platform/ui/../lib/foo'",
      "import x from '@/platform/ui/./Button'",
      "import x from '@/platform/ui/chart/../Button'",
      "import x from '@/platform/ui/chart/..'",
      "import x from '@/platform/ui//Button'",
      "import x from '@/platform/ui/Button/'",
      "import x from '@/platform/ui/%2e%2e/lib/foo'",
      "import x from '@/platform/ui\\..\\lib\\foo'",
      "import x from '@/platform/ui'",
      "import x from '@/platform/ui/'",
      "import x from '@/platform/ui/.hidden'",
      "import x from '@/platform/uikit/Button'",
      "import x from '@/platform/ui/AdminBar.client'",
      "import x from '@/platform/ui/testing/renderServer'",
      "import x from '@/platform/ui/Button.test'",
      "import x from '@/platform/ui/Button.stories'",
      "import x from '@/platform/ui/cn'",
      "export { x } from '@/platform/ui/../lib/foo'",
    ]) {
      expect(importing(line), line).toThrow(/imports .*; an examples file may import only/)
    }
  })

  it('refuses a relative import of a component file that is not on the safe list', () => {
    for (const line of [
      "import { AdminBar } from './AdminBar.client'",
      "import { Media } from './Media'",
      "import type { MediaProps } from './Media'",
    ]) {
      expect(importing(line), line).toThrow(/imports .*; an examples file may import only/)
    }
  })

  it('refuses a relative import that leaves the folder, even for a component file', () => {
    expect(importing("import { BarTrack } from './chart/BarTrack'")).toThrow(
      /imports \.\/chart\/BarTrack/,
    )
    expect(importing("import { BarTrack } from '../ui/chart/BarTrack'")).toThrow(/imports/)
  })

  it("judges ./example like any relative import: only the kit's own format file is the format", () => {
    const text = `import { defineExample } from './example'\nexport const A = defineExample({ purpose: 'x', render: () => null })\n`
    const readIn = (file) => () => readExamples(text, file)
    expect(readIn('src/platform/ui/Thing.examples.tsx')).not.toThrow()
    for (const file of [
      'src/platform/richtext/RichText.examples.tsx',
      'src/platform/richtext/editorial/FactTabs.examples.tsx',
      'src/platform/ui/chart/BarTrack.examples.tsx',
    ]) {
      expect(readIn(file), file).toThrow(/imports \.\/example; an examples file may import only/)
    }
  })

  it('judges a kit specifier by its steps alone: no step may be empty, a dot or a double dot', () => {
    // With every file counted as safe, only the shape of the specifier can refuse these
    const everything = (line) => () =>
      readWith(`${line}\n${IMPORTS}${withBody('render: () => null')}`, FILE, {
        isKitFile: () => true,
      })
    for (const line of [
      "import x from '@/platform/ui/../lib/foo'",
      "import x from '@/platform/ui/./Button'",
      "import x from '@/platform/ui//Button'",
      "import x from '@/platform/ui/Button/'",
      "import x from '@/platform/ui/.hidden'",
      "import x from '@/platform/ui/chart/..'",
    ]) {
      expect(everything(line), line).toThrow(/imports .*; an examples file may import only/)
    }
    expect(everything("import x from '@/platform/ui/Tabs.client'")).not.toThrow()
  })

  it('refuses a re-export, from anywhere: an example file exports only examples', () => {
    for (const line of [
      "export * from './Button'",
      "export { Button } from './Button'",
      "export * as X from 'react'",
      "export type { ButtonProps } from '@/platform/ui/Button'",
    ]) {
      expect(importing(line), line).toThrow(/re-exports are not a defineExample/)
    }
  })

  it('refuses a re-export from anywhere else, an export list and a default export', () => {
    expect(() => read(`export { x } from 'payload'\n${withBody('render: () => null')}`)).toThrow(
      /imports payload/,
    )
    expect(() => read(`export * from 'payload'\n`)).toThrow(/imports payload/)
    expect(() => read(`const x = 1\nexport { x }\n`)).toThrow(
      /export lists are not a defineExample/,
    )
    expect(() => read(`export default 3\n`)).toThrow(/a default export is not a defineExample/)
  })

  it('refuses a dynamic import, require and an import-equals, anywhere in the file', () => {
    expect(() =>
      read(`export const A = defineExample({ purpose: 'x', render: () => import('payload') })\n`),
    ).toThrow(/dynamic import/)
    expect(() =>
      read(`const load = () => import('./Thing')\n${withBody('render: () => null')}`),
    ).toThrow(/dynamic import/)
    expect(() => read(`const p = require('payload')\n${withBody('render: () => null')}`)).toThrow(
      /references require/,
    )
    expect(() => read(`import x = require('payload')\n${withBody('render: () => null')}`)).toThrow(
      /import x = require/,
    )
    expect(() =>
      read(`type T = typeof import('payload')\n${withBody('render: () => null')}`),
    ).toThrow(/dynamic import/)
    expect(() => read(`const m = import.meta\n${withBody('render: () => null')}`)).toThrow(
      /import\.meta/,
    )
  })

  it('refuses the environment and the network, in render, in a helper or at the top of the file', () => {
    const uses = [
      'process.env.SECRET',
      "process['env']",
      'const { env } = process',
      'const f = fetch',
      "fetch('/x')",
      'window.fetch',
      "globalThis['fetch']",
      'new XMLHttpRequest()',
      'new WebSocket("x")',
      'document.cookie',
      'eval("1")',
    ]
    for (const use of uses) {
      expect(
        () =>
          read(
            `export const A = defineExample({ purpose: 'x', render: () => { ${use}; return null } })\n`,
          ),
        `render: ${use}`,
      ).toThrow(
        /A: references (process|fetch|window|globalThis|XMLHttpRequest|WebSocket|document|eval)/,
      )
      expect(() => read(`${use}\n${withBody('render: () => null')}`), `top: ${use}`).toThrow(
        /references/,
      )
      expect(
        () => read(`function help() { ${use} }\n${withBody('render: () => null')}`),
        `helper: ${use}`,
      ).toThrow(/references/)
    }
  })

  it('says which line, and does not mind a property that only has the name', () => {
    expect(() => read(`\n\nconst x = process\n${withBody('render: () => null')}`)).toThrow(
      /references process \(line 5\)/,
    )
    expect(() =>
      read(`const o = { fetch: 1 }\nconst n = o.process\n${withBody('render: () => null')}`),
    ).not.toThrow()
  })
})
