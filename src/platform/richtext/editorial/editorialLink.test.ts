import { describe, expect, it } from 'vitest'

import { isEditorialLinkUrl, toEditorialLink, validateEditorialLink } from './editorialLink'

describe('editorial links', () => {
  it('accepts a site path or an http(s) address, nothing else', () => {
    expect(isEditorialLinkUrl('/events/fall-fest')).toBe(true)
    expect(isEditorialLinkUrl('https://wisconsindot.gov/i39')).toBe(true)
    expect(isEditorialLinkUrl('http://example.com')).toBe(true)
    expect(isEditorialLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isEditorialLinkUrl('//evil.example.com')).toBe(false)
    expect(isEditorialLinkUrl('mailto:someone@example.com')).toBe(false)
    expect(isEditorialLinkUrl('wisconsindot.gov')).toBe(false)
  })

  it('refuses addresses a browser would send off-site while they look like a site path', () => {
    // Browsers read a backslash as a slash in http(s) URLs
    expect(isEditorialLinkUrl('/\\evil.example.com')).toBe(false)
    expect(isEditorialLinkUrl('/\\/evil.example.com')).toBe(false)
    expect(isEditorialLinkUrl('/events\\..\\x')).toBe(false)
    expect(isEditorialLinkUrl('https:\\\\evil.example.com')).toBe(false)
    expect(toEditorialLink('/\\evil.example.com', 'Source')).toBeNull()
  })

  it('refuses an address longer than the limit', () => {
    expect(isEditorialLinkUrl(`https://example.com/${'a'.repeat(2048)}`)).toBe(false)
  })

  it('validates both parts or neither', () => {
    expect(validateEditorialLink(null, null)).toBe(true)
    expect(validateEditorialLink('  ', '')).toBe(true)
    expect(validateEditorialLink('https://example.com', 'Read more')).toBe(true)
    expect(validateEditorialLink('https://example.com', '')).toMatch(/link text/)
    expect(validateEditorialLink('', 'Read more')).toMatch(/address/)
    expect(validateEditorialLink('javascript:alert(1)', 'Read more')).toMatch(/https:\/\//)
  })

  it('resolves a site path as internal and an address as external', () => {
    expect(toEditorialLink('/events', 'All events')).toEqual({
      href: '/events',
      label: 'All events',
      external: false,
      appearance: 'default',
    })
    expect(toEditorialLink(' https://example.com ', ' Source ')).toMatchObject({
      href: 'https://example.com',
      label: 'Source',
      external: true,
    })
  })

  it('drops a link that is missing a part or has an unsafe address', () => {
    expect(toEditorialLink('https://example.com', null)).toBeNull()
    expect(toEditorialLink(null, 'Source')).toBeNull()
    expect(toEditorialLink('javascript:alert(1)', 'Source')).toBeNull()
  })
})
