// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readExamples } from '../../../scripts/reference/examplesReader.mjs'
import { safeKitFilesIn } from '../../../scripts/reference/kitFiles.mjs'
import { defaultSettings, type Example } from './example'
import { expectAccessible } from './testing/expectAccessible'
import { settingVariations } from './testing/exampleSettings'

// next/link renders a plain <a> in tests (no router)
vi.mock('next/link', () => ({
  default: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}))

afterEach(cleanup)

const ROOT = join(import.meta.dirname, '../../..')
const FOLDERS = ['src/platform/ui', 'src/platform/richtext']
const FILES = FOLDERS.flatMap((folder) =>
  (readdirSync(join(ROOT, folder), { recursive: true, encoding: 'utf8' }) as string[])
    .filter((file) => /\.examples(\.client)?\.tsx$/.test(file))
    .map((file) => `${folder}/${file}`),
).sort()

// The same safe list the generator reads an examples file with, so this test and the reference build agree
const KIT_FILES = safeKitFilesIn(ROOT) as Set<string>
const POLICY = { isKitFile: (file: string) => KIT_FILES.has(file) }

const loaded = await Promise.all(
  FILES.map(
    async (file) =>
      [
        file,
        (await import(/* @vite-ignore */ join(ROOT, file))) as Record<string, Example>,
      ] as const,
  ),
)

describe('showcase examples (#1532)', () => {
  it('exist for the components the format was proved on', () => {
    for (const file of ['Button', 'Badge', 'Tabs']) {
      expect(FILES, file).toContain(`src/platform/ui/${file}.examples.tsx`)
    }
    // An example with a handler, or a state the server can't pass on, lives in a client file
    expect(FILES).toContain('src/platform/ui/Badge.examples.client.tsx')
  })

  describe.each(loaded)('%s', (file, module) => {
    const read = readExamples(readFileSync(join(ROOT, file), 'utf8'), file, POLICY)

    it('exports exactly the examples the showcase index lists, as the index reads them', () => {
      expect(Object.keys(module)).toEqual(read.map((example) => example.name))
      for (const { name, purpose, settings } of read) {
        expect(module[name]?.purpose, name).toBe(purpose)
        expect(module[name]?.settings ?? {}, name).toEqual(settings)
      }
    })

    it.each(read.map((example) => example.name))(
      '%s renders, and passes axe, as it starts and with each setting changed',
      async (name) => {
        const example = module[name]
        if (!example) throw new Error(`${name} is not exported`)
        const starts = [defaultSettings(example.settings), ...settingVariations(example.settings)]
        for (const values of starts) {
          const { container, unmount } = render(<>{example.render(values as never)}</>)
          expect(container.firstChild, name).not.toBeNull()
          await expectAccessible(container)
          unmount()
        }
      },
    )
  })
})
