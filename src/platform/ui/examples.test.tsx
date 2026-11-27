// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readExamples } from '../../../scripts/reference/showcase.mjs'
import { defaultSettings, type Example, type ExampleSetting } from './example'
import { expectAccessible } from './testing/expectAccessible'

// next/link renders a plain <a> in tests (no router)
vi.mock('next/link', () => ({
  default: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}))

afterEach(cleanup)

const ROOT = join(import.meta.dirname, '../../..')
const FOLDERS = ['src/platform/ui', 'src/platform/richtext']
const FILES = FOLDERS.flatMap((folder) =>
  (readdirSync(join(ROOT, folder), { recursive: true, encoding: 'utf8' }) as string[])
    .filter((file) => file.endsWith('.examples.tsx'))
    .map((file) => `${folder}/${file}`),
).sort()

const loaded = await Promise.all(
  FILES.map(
    async (file) =>
      [
        file,
        (await import(/* @vite-ignore */ join(ROOT, file))) as Record<string, Example>,
      ] as const,
  ),
)

/** Each way a visitor could change one setting from its default, the others left alone */
function variations(settings: Record<string, ExampleSetting>) {
  const start = defaultSettings(settings) as Record<string, unknown>
  return Object.entries(settings).flatMap(([key, setting]) => {
    const others =
      setting.kind === 'boolean'
        ? [!setting.default]
        : setting.kind === 'choice'
          ? setting.options.filter((option) => option !== setting.default)
          : [`${setting.default} again`]
    return others.map((value) => ({ ...start, [key]: value }))
  })
}

describe('showcase examples (#1532)', () => {
  it('exist for the components the format was proved on', () => {
    for (const file of ['Button', 'Badge', 'Tabs']) {
      expect(FILES, file).toContain(`src/platform/ui/${file}.examples.tsx`)
    }
  })

  describe.each(loaded)('%s', (file, module) => {
    const read = readExamples(readFileSync(join(ROOT, file), 'utf8'), file)

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
        const starts = [defaultSettings(example.settings), ...variations(example.settings ?? {})]
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
