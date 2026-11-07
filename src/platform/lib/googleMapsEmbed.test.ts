import { describe, expect, it } from 'vitest'

import { toGoogleMapsEmbedUrl } from './googleMapsEmbed'

const SHARE_EMBED = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2000!2d-89.3!3d43.1'
const MY_MAPS_EMBED = 'https://www.google.com/maps/d/embed?mid=1AbC_dEf&ehbc=2E312F'

describe('toGoogleMapsEmbedUrl (#764)', () => {
  it('accepts the address Google gives for "Embed a map"', () => {
    expect(toGoogleMapsEmbedUrl(SHARE_EMBED)).toBe(SHARE_EMBED)
  })

  it('accepts a shared My Maps embed address', () => {
    expect(toGoogleMapsEmbedUrl(MY_MAPS_EMBED)).toBe(MY_MAPS_EMBED)
    expect(toGoogleMapsEmbedUrl('https://www.google.com/maps/d/u/0/embed?mid=1AbC_dEf')).toBe(
      'https://www.google.com/maps/d/u/0/embed?mid=1AbC_dEf',
    )
  })

  it('takes the address out of a pasted iframe snippet', () => {
    const snippet = `<iframe src="${SHARE_EMBED}" width="600" height="450" loading="lazy"></iframe>`
    expect(toGoogleMapsEmbedUrl(snippet)).toBe(SHARE_EMBED)
  })

  it('ignores spaces around the address', () => {
    expect(toGoogleMapsEmbedUrl(`  ${MY_MAPS_EMBED}\n`)).toBe(MY_MAPS_EMBED)
  })

  it.each([
    ['another site', 'https://example.com/maps/embed?pb=1'],
    ['a look-alike host', 'https://www.google.com.evil.example/maps/embed?pb=1'],
    ['a subdomain trick', 'https://evil.example/https://www.google.com/maps/embed?pb=1'],
    ['plain http', 'http://www.google.com/maps/embed?pb=1'],
    ['a Google page that is not an embed', 'https://www.google.com/maps/place/Madison'],
    ['a share link', 'https://maps.app.goo.gl/abc123'],
    ['the keyed embed API', 'https://www.google.com/maps/embed/v1/place?key=SECRET&q=Madison'],
    ['an address with a password', 'https://user:pass@www.google.com/maps/embed?pb=1'],
    ['an address on another port', 'https://www.google.com:8443/maps/embed?pb=1'],
    ['a script', 'javascript:alert(1)'],
    ['text', 'not a link'],
    ['an empty string', ''],
  ])('refuses %s', (_name, value) => {
    expect(toGoogleMapsEmbedUrl(value)).toBeNull()
  })

  it('refuses an iframe snippet whose address is not a Google embed', () => {
    expect(toGoogleMapsEmbedUrl('<iframe src="https://example.com/x"></iframe>')).toBeNull()
  })

  it('refuses nothing-but-markup, an empty value and a non-string', () => {
    expect(toGoogleMapsEmbedUrl('<iframe></iframe>')).toBeNull()
    expect(toGoogleMapsEmbedUrl(undefined)).toBeNull()
    expect(toGoogleMapsEmbedUrl(null)).toBeNull()
  })
})
