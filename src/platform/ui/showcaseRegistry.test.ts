import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { COMPONENT_LOADERS, EXAMPLES_LOADERS } from './showcaseRegistry'

type Index = { components: { name: string; examples: { files: string[] } | null }[] }
const index = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../docs/reference/showcase-index.json'), 'utf8'),
) as Index

describe('the showcase import map (#1532)', () => {
  it('has a loader for every component in the showcase index, and no other', () => {
    expect(Object.keys(COMPONENT_LOADERS).sort()).toEqual(
      index.components.map((c) => c.name).sort(),
    )
  })

  it('has a loader for every examples file in the index, and no other', () => {
    const files = new Set(index.components.flatMap((c) => c.examples?.files ?? []))

    expect(Object.keys(EXAMPLES_LOADERS).sort()).toEqual([...files].sort())
  })

  it('loads an examples file as its module, with the examples it exports', async () => {
    const loaded = (await EXAMPLES_LOADERS['src/platform/ui/Badge.examples.tsx']!()) as Record<
      string,
      { purpose: string }
    >

    expect(Object.keys(loaded)).toContain('Variants')
    expect(typeof loaded.Variants?.purpose).toBe('string')
  })

  it('loads a component as the component itself', async () => {
    expect(typeof (await COMPONENT_LOADERS.Badge!())).toBe('function')
  })
})
