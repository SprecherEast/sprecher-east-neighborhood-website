import { describe, expect, it } from 'vitest'

import type { ResolvedLink } from '@/platform/lib'

import { splitDefinitionAtSource } from './definitionWithSource'

const source: ResolvedLink = {
  href: 'https://example.org/budget',
  label: 'operating budget',
  external: true,
  appearance: 'default',
}

describe('splitDefinitionAtSource', () => {
  it('returns null when the tab has no source link', () => {
    expect(splitDefinitionAtSource('Pays for services.', null)).toBeNull()
  })

  it('returns null when the definition never says the link text, so the caller keeps a source line', () => {
    expect(splitDefinitionAtSource('Pays for services.', source)).toBeNull()
  })

  it('splits the definition around the first mention of the link text', () => {
    const parts = splitDefinitionAtSource(
      'Also called the operating budget, it pays for services.',
      source,
    )
    expect(parts).toEqual([
      { kind: 'text', text: 'Also called the ' },
      { kind: 'link', link: source },
      { kind: 'text', text: ', it pays for services.' },
    ])
  })

  it('matches without regard to capital letters and keeps the definition’s own spelling', () => {
    const parts = splitDefinitionAtSource('Operating budget money pays for services.', source)
    expect(parts?.[0]).toEqual({
      kind: 'link',
      link: { ...source, label: 'Operating budget' },
    })
    expect(parts?.[1]).toEqual({ kind: 'text', text: ' money pays for services.' })
  })

  it('links only the first mention', () => {
    const parts =
      splitDefinitionAtSource('The operating budget, or operating budget.', source) ?? []
    expect(parts.filter((part) => part.kind === 'link')).toHaveLength(1)
  })

  it('leaves out an empty text part when the link text starts or ends the definition', () => {
    const parts = splitDefinitionAtSource('operating budget', source)
    expect(parts).toEqual([{ kind: 'link', link: source }])
  })
})
