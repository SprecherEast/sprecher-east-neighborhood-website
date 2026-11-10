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

  it('says visits are counted without cookies, names or emails, and Do Not Track is honored', () => {
    expect(words).toMatch(/sets no cookies/)
    expect(words).toMatch(/keeps no names, emails or IP addresses/)
    expect(words).toMatch(/Do Not Track/)
  })

  it('names everything the counter stores, and how long it is kept', () => {
    for (const item of [
      'title',
      'browser',
      'device',
      'system',
      'screen size',
      'language',
      'city',
      'delete',
    ]) {
      expect(words).toContain(item)
    }
    expect(words).toContain('We keep these notes until we delete them')
    expect(words).not.toContain('keep the counts')
  })

  it('keeps every sentence to 25 words or fewer', () => {
    for (const sentence of words.split(/(?<=[.!])\s+/)) {
      expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(25)
    }
  })

  it('speaks as we, never as I or me', () => {
    expect(words).not.toMatch(/\b(I|me|my)\b/)
  })
})
