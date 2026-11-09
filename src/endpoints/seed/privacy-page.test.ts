import { describe, expect, it } from 'vitest'

import { privacyPage } from './privacy-page'

function textOf(value: unknown): string {
  if (Array.isArray(value)) return value.map(textOf).join(' ')
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    return [
      typeof node.text === 'string' ? node.text : '',
      ...Object.values(node).map(textOf),
    ].join(' ')
  }
  return ''
}

describe('Privacy page seed (#950)', () => {
  const page = privacyPage()
  const words = textOf(page.layout)

  it('lives at /privacy', () => {
    expect(page.slug).toBe('privacy')
  })

  it('says visits are counted without cookies or personal details, and Do Not Track is honored', () => {
    expect(words).toMatch(/no cookies/)
    expect(words).toMatch(/personal details/)
    expect(words).toMatch(/Do Not Track/)
  })

  it('speaks as we, never as I or me', () => {
    expect(words).not.toMatch(/\b(I|me|my)\b/)
  })
})
